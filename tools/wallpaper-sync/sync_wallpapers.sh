#!/bin/bash
# sync_wallpapers.sh — PC -> TV wallpaper pool sync (image lane).
#
# Cobalt renders images natively in-page (finding 35), so the pool is now
# plain image files — no 4K HEVC encode step. The Odin page lane shows the
# same files through its art seam, video clips remain a page-lane extra.
#
# Source of truth: ~/Pictures/tv-wallpapers/  (.jpg/.jpeg/.png/.webp/.bmp)
# Each image is pushed as-is to the TV launcher asset root; the manifest
# (self.AlvidaaWallpaperList) carries id/file/md5/kind so either lane can
# pick the right renderer.
#
# Push protocol (tv-work skill): base64 over SSH stdin, md5 verify on TV, then mv.
set -u
TV_IP=192.168.0.15
TV_PORT=8008
KEY="$(cd "$(dirname "$0")/../.." && pwd)/keys/ur8s_root"
RECON="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$HOME/Pictures/tv-wallpapers"
TV_DIR="/APPS/alvidaa/launcher/wallpapers"
CACHE="$RECON/tools/wallpaper-sync/.cache"
SSH_OPTS=(-F /dev/null -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p "$TV_PORT")
SSH() { timeout 30 ssh "${SSH_OPTS[@]}" "root@$TV_IP" "$1" 2>&1 | grep -v "WARNING\|post-quantum\|Permanently"; }

mkdir -p "$SRC"
shopt -s nullglob

# ---- inventory every source image --------------------------------------------
declare -A WANT_MD5   # id -> md5 of the source file
declare -A WANT_FILE  # id -> file name on the TV
declare -A WANT_SRC   # id -> local file to push (normalized when large)
LIST_JSON=""
for f in "$SRC"/*.jpg "$SRC"/*.jpeg "$SRC"/*.png "$SRC"/*.webp "$SRC"/*.bmp; do
  base="$(basename "$f")"; stem="${base%.*}"; ext="${base##*.}"; ext="$(echo "$ext" | tr 'A-Z' 'a-z')"
  id="$(printf '%s' "$stem" | tr -cs 'A-Za-z0-9-' '-' | tr 'A-Z' 'a-z' | sed 's/^[-]*//;s/[-]*$//')"
  [ -z "$id" ] && { echo "skip (bad id): $base" >&2; continue; }
  # Oversized sources are normalized to 4K JPEG before the push: the panel
  # displays at 1080p regardless (finding 35), and multi-megabyte PNG/WebP
  # transfers over the base64 lane are slow and lossy-prone. A normalized
  # file keeps the original id but lands as <id>.jpg.
  push="$f"
  size="$(stat -c%s "$f")"
  if [ "$size" -gt 6291456 ] && [ "$ext" != "jpg" ]; then
    push="$CACHE/$id.jpg"
    mkdir -p "$CACHE"
    if ! magick "$f" -resize '3840x2160>' -quality 90 "$push"; then
      echo "normalize FAILED: $base (pushing original)" >&2; push="$f"
    fi
    ext="jpg"
  fi
  md5="$(md5sum "$push" | cut -d' ' -f1)"
  WANT_SRC[$id]="$push"
  WANT_MD5[$id]="$md5"
  WANT_FILE[$id]="$id.$ext"
  LIST_JSON="$LIST_JSON{\"id\":\"$id\",\"file\":\"$id.$ext\",\"md5\":\"$md5\",\"kind\":\"image\"},"
  echo "queued $base -> $id.$ext ($(numfmt --to=iec $(stat -c%s "$f") 2>/dev/null || stat -c%s "$f"))"
done
LIST_JSON="${LIST_JSON%,}"
MANIFEST="self.AlvidaaWallpaperList=[$LIST_JSON];"

# ---- what does the TV already have? ------------------------------------------
SSH "mkdir -p $TV_DIR; /usr/local/bin/busybox md5sum $TV_DIR/* 2>/dev/null" > /tmp/wps_tvmeta.$$
declare -A HAVE_MD5
while read -r m p; do
  [ -n "$m" ] || continue
  b="$(basename "$p")"; HAVE_MD5[$b]="$m"
done < /tmp/wps_tvmeta.$$
rm -f /tmp/wps_tvmeta.$$

# ---- push new / changed images -------------------------------------------------
PUSHED=0
for id in "${!WANT_MD5[@]}"; do
  file="${WANT_FILE[$id]}"
  if [ "${HAVE_MD5[$file]:-}" = "${WANT_MD5[$id]}" ]; then continue; fi
  pushfile="${WANT_SRC[$id]}"
  got="$(base64 -w0 "$pushfile" | timeout 300 ssh "${SSH_OPTS[@]}" "root@$TV_IP" \
    "/usr/local/bin/busybox base64 -d > $TV_DIR/$file.new && /usr/local/bin/busybox md5sum $TV_DIR/$file.new" 2>/dev/null | tr -d '\r' | cut -d' ' -f1)"
  if [ "$got" = "${WANT_MD5[$id]}" ]; then
    SSH "/bin/mv -f $TV_DIR/$file.new $TV_DIR/$file" >/dev/null
    echo "pushed $file (${WANT_MD5[$id]:0:8})"; PUSHED=$((PUSHED+1))
  else
    echo "PUSH VERIFY FAIL $file (want ${WANT_MD5[$id]}, got '${got}')" >&2
    exit 1
  fi
done

# ---- manifest (self.AlvidaaWallpaperList) --------------------------------------
MAN_MD5="$(printf '%s' "$MANIFEST" | md5sum | cut -d' ' -f1)"
got="$(printf '%s' "$MANIFEST" | base64 -w0 | timeout 30 ssh "${SSH_OPTS[@]}" "root@$TV_IP" \
  "/usr/local/bin/busybox base64 -d > $TV_DIR/wallpapers.js.new && /usr/local/bin/busybox md5sum $TV_DIR/wallpapers.js.new" 2>/dev/null | tr -d '\r' | cut -d' ' -f1)"
if [ "$got" = "$MAN_MD5" ]; then
  SSH "/bin/mv -f $TV_DIR/wallpapers.js.new $TV_DIR/wallpapers.js" >/dev/null
  echo "manifest wallpapers.js (${MAN_MD5:0:8}) — ${#WANT_MD5[@]} wallpapers"
else
  echo "MANIFEST VERIFY FAIL (want $MAN_MD5 got '$got')" >&2
  exit 1
fi

# ---- prune files whose source image is gone ------------------------------------
for file in "${!HAVE_MD5[@]}"; do
  case "$file" in wallpapers.js) continue;; esac
  keep=0
  for id in "${!WANT_FILE[@]}"; do [ "${WANT_FILE[$id]}" = "$file" ] && keep=1; done
  [ "$file" = "testcard.mp4" ] || [ "$file" = "plasma.mp4" ] && keep=1   # legacy clips stay
  if [ "$keep" = "0" ]; then
    SSH "/bin/rm -f $TV_DIR/$file" >/dev/null && echo "pruned $file"
  fi
done
echo "sync done: ${#WANT_MD5[@]} wallpapers, $PUSHED pushed"
