/* Module 36 — the image wallpaper engine (Cobalt lane).
 *
 * Cobalt paints bitmaps natively in-page, so the wallpaper pool is plain
 * image files served by the bridge; the manifest travels as a script tag
 * (script src bypasses the file:// origin rules that XHR cannot). The
 * engine mirrors the page lane's AlvidaaWallpaper API so settings rows can
 * drive either lane with one door.
 *
 * Owner-locked design: ticks are pool membership, Timer is the swap rhythm
 * (off/10m/1h/1d), an empty pool keeps the baked art, one tick with Timer
 * off pins that image. Video clips stay a page-lane extra — Cobalt has no
 * media pipeline, so this engine only paints images through the art seam.
 *
 * The page lane runs its own engine over the <video> element; this module
 * is inert there (the page's #wallpaper element is the lane marker).
 */
(function (self) {
  "use strict";
  if (self.document && self.document.getElementById("wallpaper")) return;
  var kit = self.AlvidaaNativeKit;
  var TIMERS = { off: 0, "10m": 600000, "1h": 3600000, "1d": 86400000 };
  var BASE = "http://127.0.0.1:8770/wallpapers/";
  var BAKED = self.AlvidaaNativeWallpaper;
  var LIST = self.AlvidaaWallpaperList || [];
  // Prefs load lazily: at bundle-load time kit.sdk (the vendor storage
  // singleton that gives durability) is not installed yet — that install
  // happens at component create. Reading early would silently fall back
  // to empty and lose the saved choice on every boot. loadPrefs() waits
  // for sdk; start() in 30-lifecycle calls refresh() right after
  // readPrefs(), which is where the saved pool/timer actually land.
  var pool = null, timer = null, seq = 0;
  var swapTimer = null;
  function loadPrefs() {
    if (pool !== null || !kit.sdk || !kit.sdk.storage) return;
    pool = kit.readPref("alvidaa.wp.pool", []);
    timer = kit.readPref("alvidaa.wp.timer", "off");
    seq = kit.readPref("alvidaa.wp.seq", 0);
  }
  function save() {
    if (pool === null) return;
    kit.writePref("alvidaa.wp.pool", pool);
    kit.writePref("alvidaa.wp.timer", timer);
    kit.writePref("alvidaa.wp.seq", seq);
  }
  function activeIds() {
    var ids = [];
    if (pool === null) return ids;
    for (var i = 0; i < LIST.length; i++) if (pool.indexOf(LIST[i].id) !== -1) ids.push(LIST[i].id);
    return ids;
  }
  function fileOf(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }
  function current() {
    var ids = activeIds();
    if (!ids.length) return null;
    if (timer === "off" || ids.length === 1) return ids[0];
    seq = ((seq % ids.length) + ids.length) % ids.length;
    return ids[seq];
  }
  // The component reads kit.wallpaperStyle() during render; bump the paint
  // by nudging the live vm once it exists (self.AlvidaaNativeActive).
  function repaint() {
    var vm = self.AlvidaaNativeActive;
    if (vm && vm.$forceUpdate) { try { vm.$forceUpdate(); } catch (e) { void e; } }
  }
  function apply() {
    loadPrefs();
    if (swapTimer) { clearTimeout(swapTimer); swapTimer = null; }
    var id = current();
    var entry = id ? fileOf(id) : null;
    if (!entry) {
      self.AlvidaaNativeWallpaper = BAKED;
      self.AlvidaaWallpaperKind = null;
      self.AlvidaaNativeWallpaperSize = null;
      self.AlvidaaNativeWallpaperLum = null;
    } else {
      self.AlvidaaNativeWallpaper = BASE + entry.file + "?v=" + (entry.md5 || "");
      self.AlvidaaWallpaperKind = "image";
      self.AlvidaaNativeWallpaperSize =
        (entry.w && entry.h) ? [entry.w, entry.h] : null;
      // 16x9 tile luma (row-major, 0-255) baked by the sync script:
      // drives kit.inkForRect so zen ink follows the art under the
      // block without canvas reads on the panel.
      self.AlvidaaNativeWallpaperLum =
        entry.lum && entry.lum.length === 144 ? entry.lum : null;
    }
    repaint();
    if (entry && timer !== "off" && activeIds().length > 1) {
      swapTimer = setTimeout(function () { seq++; save(); apply(); }, TIMERS[timer] || 0);
    }
  }
  self.AlvidaaWallpaper = {
    get list() { return LIST; },
    state: function () { return { pool: pool ? pool.slice() : [], timer: timer || "off", current: current() }; },
    timers: ["off", "10m", "1h", "1d"],
    setPool: function (p) { loadPrefs(); pool = p.slice(); seq = 0; save(); apply(); },
    setTimer: function (t) { loadPrefs(); timer = TIMERS[t] !== undefined ? t : "off"; save(); apply(); },
    next: function () { seq++; save(); apply(); },
    refresh: function () { apply(); }
  };

  // Manifest: a script tag from the bridge — scripts ignore the file://
  // origin rules that would block XHR. On failure the baked art stands.
  if (self.document && self.document.createElement && self.document.head) {
    var s = self.document.createElement("script");
    s.src = BASE + "wallpapers.js";
    s.onload = function () {
      if (self.AlvidaaWallpaperList && self.AlvidaaWallpaperList.length) {
        LIST = self.AlvidaaWallpaperList;
      }
      apply();
    };
    s.onerror = function () { apply(); };
    self.document.head.appendChild(s);
  }
  apply();
}(self));
