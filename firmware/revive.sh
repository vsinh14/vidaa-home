#!/bin/sh
BB=/usr/local/bin/busybox
CACHE=/var/local/hisenseUI/cobalt_home/.cache/cobalt
BACKUP=/var/local/alvidaa/backup
APP=/APPS/pkgs/tv.vidaa.app.operationui/CHA/apps/launcher/js/app.js
ENVF=/var/local/alvidaa/systemui.env
echo "pre: SystemUI=[$(/bin/pidof SystemUI)]"
/bin/rm -rf "$BACKUP/compiled_js" "$BACKUP/uncompiled_js"
/bin/rm -rf "$CACHE/compiled_js" "$CACHE/uncompiled_js"
for d in compiled_js uncompiled_js; do
  $BB mkdir -p "$CACHE/$d" || echo "MKDIR FAIL $d"
  /bin/chown 311:311 "$CACHE/$d" || echo "CHOWN FAIL $d"
  /bin/chmod 0751 "$CACHE/$d" || echo "CHMOD FAIL $d"
done
echo "cache reset; backup dir now:"
$BB ls -l "$BACKUP"
if /bin/pidof SystemUI >/dev/null 2>&1; then
  echo "SystemUI already live, not launching"
else
  (
    cd /opt/hisenseUI || exit 1
    while IFS= read -r -d '' item; do
      case "$item" in *=*) export "$item" ;; esac
    done < "$ENVF"
    trap "" HUP
    exec /usr/local/bin/secure_exec SystemUI /opt/hisenseUI/startgui.sh \
      >/dev/null 2>&1 </dev/null
  ) >/dev/null 2>&1 </dev/null &
  echo "revive bg pid $!"
fi
$BB sleep 25
echo "post: SystemUI=[$(/bin/pidof SystemUI)]"
/bin/md5sum "$APP"
