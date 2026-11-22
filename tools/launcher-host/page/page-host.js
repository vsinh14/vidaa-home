/* Page host boot: wallpaper engine, art seam, Vue mount, key wire.
 *
 * Load order in home.js: vue.min.js, native modules 00..80,
 * page-platform.js, page-sdk.js, this file. The manifest script
 * (wallpapers.js) loads before home.js from the page.
 *
 * Wallpaper design (owner-locked): ticks are pool membership, Timer is
 * the swap rhythm (off/10m/1h/1d), an empty pool keeps the baked art,
 * one tick with Timer off pins that clip. The engine is the fork-lane
 * code carried over verbatim, plus the P100 art seam: when a clip is
 * live, kit.wallpaperStyle turns the full-page art transparent so the
 * <video> on the hardware plane shows through the GUI render.
 *
 * Panel facts this host codes around (proven on the 85U7SE Odin webview):
 *  - The initial containing block is locked at 1280x720 CSS (the shell
 *    bitmap-scales it x1.5 onto the 1920x1080 GUI plane, DPR reports 1,
 *    the viewport meta is ignored) — the P100 tree paints at 1920 stage
 *    px and overflows, which is fine; only fonts read soft.
 *  - Vue's $mount("#app") REPLACES the #app element, so the plane
 *    promotion lives on the #promote wrapper in home.html, not on #app.
 *  - The component root (#alvidaa-native) hardcodes backgroundColor
 *    #000; over a live plane it must be forced transparent (root fix
 *    below) or it buries the video — the art seam alone is not enough.
 */
(function (self) {
  "use strict";
  try {
    self.__stage && self.__stage("HOST-IN");
    boot(self);
  } catch (error) {
    self.__stage && self.__stage("H_THROW " + String(error && error.message).slice(0, 60));
  }
}(self));

function boot(self) {
  var kit = self.AlvidaaNativeKit;
  var doc = self.document;

  // ---- wallpaper engine ---------------------------------------------------
  var vid = doc.getElementById("wallpaper");
  var LIST = self.AlvidaaWallpaperList || [];
  var TIMERS = { off: 0, "10m": 600000, "1h": 3600000, "1d": 86400000 };
  function load(key, dflt) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? dflt : v; }
    catch (e) { return dflt; }
  }
  var pool = load("alvidaa.wp.pool", []);
  var timer = load("alvidaa.wp.timer", "off");
  var seq = load("alvidaa.wp.seq", 0);
  function save() {
    try {
      localStorage.setItem("alvidaa.wp.pool", JSON.stringify(pool));
      localStorage.setItem("alvidaa.wp.timer", JSON.stringify(timer));
      localStorage.setItem("alvidaa.wp.seq", JSON.stringify(seq));
    } catch (e) {}
  }
  function activeIds() {
    var ids = [];
    for (var i = 0; i < LIST.length; i++) if (pool.indexOf(LIST[i].id) !== -1) ids.push(LIST[i].id);
    return ids;
  }
  var swapTimer = null;
  function showClip(file) {
    var ver = "";
    for (var i = 0; i < LIST.length; i++) if ("/wallpapers/" + LIST[i].file === file || LIST[i].file === file) { ver = "?v=" + LIST[i].md5; break; }
    var url = "/wallpapers/" + file + ver;
    if (vid.getAttribute("data-src") !== url) {
      vid.setAttribute("data-src", url);
      vid.src = url;
      vid.load();
    }
    var p = vid.play();
    if (p && p.catch) p.catch(function (e) { self.__playErr = (e && e.name) || String(e); });
  }
  function current() {
    var ids = activeIds();
    if (!ids.length) return null;
    if (timer === "off" || ids.length === 1) return ids[0];
    seq = ((seq % ids.length) + ids.length) % ids.length;
    return ids[seq];
  }
  function fileOf(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i].file;
    return null;
  }
  function apply() {
    if (swapTimer) { clearTimeout(swapTimer); swapTimer = null; }
    var id = current();
    var file = id ? fileOf(id) : null;
    if (!file) {
      self.AlvidaaWallpaperActive = false;
      self.AlvidaaWallpaperKind = null;
      self.AlvidaaNativeWallpaper = BAKED;
      doc.body.classList.remove("wp");
      vid.removeAttribute("src"); vid.load(); vid.removeAttribute("data-src");
      return;
    }
    self.AlvidaaWallpaperActive = true;
    if (isImage(file)) {
      // Image lane: the art seam paints the file (Cobalt handles the
      // bitmap), the video element stays dark and hidden.
      self.AlvidaaWallpaperKind = "image";
      self.AlvidaaNativeWallpaper = "/wallpapers/" + file + "?v=" + md5Of(file);
      doc.body.classList.remove("wp");
      vid.removeAttribute("src"); vid.load(); vid.removeAttribute("data-src");
    } else {
      self.AlvidaaWallpaperKind = "video";
      self.AlvidaaNativeWallpaper = BAKED;
      doc.body.classList.add("wp");
      showClip(file);
    }
    if (timer !== "off") {
      swapTimer = setTimeout(function () { seq++; save(); apply(); }, TIMERS[timer] || 0);
    }
  }
  var failed = {};
  // The bundle's baked art is the empty-pool fallback; images travel
  // through the art seam (Cobalt paints bitmaps natively), videos through
  // the hardware plane element.
  var BAKED = self.AlvidaaNativeWallpaper;
  function isImage(file) { return /\.(png|jpe?g|webp|bmp)$/i.test(file || ""); }
  function md5Of(file) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].file === file) return LIST[i].md5 || "";
    return "";
  }
  vid.addEventListener("error", function () {
    var ids = activeIds();
    if (!ids.length) return;
    var cur = current();
    if (cur) failed[cur] = true;
    for (var i = 0; i < ids.length; i++) {
      var cand = ids[(ids.indexOf(cur) + 1 + i) % ids.length];
      if (!failed[cand]) { seq = ids.indexOf(cand); save(); apply(); return; }
    }
  });
  self.AlvidaaWallpaper = {
    list: LIST,
    state: function () { return { pool: pool.slice(), timer: timer, current: current() }; },
    timers: ["off", "10m", "1h", "1d"],
    setPool: function (p) { pool = p.slice(); failed = {}; seq = 0; save(); apply(); },
    setTimer: function (t) { timer = TIMERS[t] !== undefined ? t : "off"; save(); apply(); },
    next: function () { seq++; save(); apply(); },
    refresh: function () { apply(); }
  };
  // Test hooks (harmless in production): ?wpsel=<id> pins the pool to one
  // clip; ?wpdebug arms the pool with the first clip when it is empty.
  var msel = location.search.match(/[?&]wpsel=([A-Za-z0-9-]+)/);
  if (msel) {
    for (var q = 0; q < LIST.length; q++) if (LIST[q].id === msel[1]) { pool = [msel[1]]; save(); }
  } else if (/[?&]wpdebug/.test(location.search) && LIST.length && !pool.length) {
    pool = [LIST[0].id]; save();
  }

  // ---- art seam ------------------------------------------------------------
  // When a clip owns the video plane, the baked art must stop painting the
  // full-page box or it hides the plane. P100's scrims (SCRIM/SUPER) keep
  // their own alphas, so chrome stays legible over live pixels.
  var baseStyle = kit.wallpaperStyle;
  kit.wallpaperStyle = function () {
    // Video owns the plane: get the art box out of the way. An image
    // wallpaper rides the art seam itself (Cobalt paints bitmaps), so the
    // base style — pointed at the synced file — is exactly right there.
    if (self.AlvidaaWallpaperActive && self.AlvidaaWallpaperKind === "video") {
      return { backgroundColor: "transparent", backgroundImage: "none" };
    }
    return baseStyle();
  };

  apply();
  self.__stage && self.__stage("ENGINE");

  // ---- mount ----------------------------------------------------------------
  // The component root (#alvidaa-native) hardcodes backgroundColor #000,
  // which buries the video plane under an opaque full-viewport box (the
  // art seam override only reached the inner art child). Force the root
  // transparent whenever the plane is live, on every render.
  //
  // Even-pixel snap: the shell upscales this webview's 1280x720 CSS
  // framebuffer x1.5 onto the 1920x1080 GUI plane. A box edge on an ODD
  // CSS px lands on a half device pixel and gets blended (the "blur");
  // an EVEN px lands exactly on the grid and survives the upscale with
  // zero resampling. Snap every px length in the tree to even integers —
  // solid fills and pxText glyphs become mathematically sharp; only real
  // font outlines stay soft (inherent to the 1280 framebuffer).
  function evenSnap(vnode) {
    if (!vnode || typeof vnode !== "object") return;
    var st = vnode.data && vnode.data.style;
    if (st) {
      for (var k in st) {
        var v = st[k];
        if (typeof v === "string" && v.indexOf("px") !== -1) {
          st[k] = v.replace(/(-?\d+(?:\.\d+)?)px/g, function (_, n) {
            return (Math.round(parseFloat(n) / 2) * 2) + "px";
          });
        }
      }
    }
    var kids = vnode.children;
    if (Array.isArray(kids)) {
      for (var i = 0; i < kids.length; i++) evenSnap(kids[i]);
    }
  }
  var baseComp = self.AlvidaaNativeComponent;
  self.AlvidaaNativeComponent = function (sdk2) {
    var comp = baseComp(sdk2);
    var baseRender = comp.render;
    comp.render = function (h) {
      var root = baseRender.call(this, h);
      evenSnap(root);
      if (self.AlvidaaWallpaperActive && root && root.data &&
          root.data.style && root.data.style.backgroundColor) {
        root.data.style.backgroundColor = "transparent";
      }
      return root;
    };
    return comp;
  };
  var sdk = self.AlvidaaPageSDK();
  var vm = new self.Vue(self.AlvidaaNativeComponent(sdk));
  vm.$mount("#app");
  self.__stage && self.__stage("MOUNTED");
  if (vm.$nextTick && vm.routeFocus) {
    vm.$nextTick(function () { try { vm.routeFocus(); } catch (_) {} });
  }

  // ---- keys ------------------------------------------------------------------
  // Remote codes arrive as browser keyCodes (KEYMAP in page-sdk). Back is
  // sent by this browser as several codes; normalize before the handler.
  var BACKS = { 8: 1, 27: 1, 17: 1, 461: 1, 10009: 1 };
  doc.addEventListener("keydown", function (e) {
    var code = BACKS[e.keyCode] ? 461 : e.keyCode;
    var handled = false;
    try { handled = !!vm.handleKey(code); } catch (_) {}
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Diagnostics hook for panel checks: ?hud=1 paints a two-line status
  // banner. Cheap fields only — layout queries (getBoundingClientRect,
  // elementFromPoint) are banned here: forced layout every tick starves
  // the Odin compositor and freezes the plane.
  if (/[?&]hud=1/.test(location.search)) {
    var hud = doc.createElement("pre");
    hud.id = "hud";
    hud.style.cssText = "position:fixed;left:0;top:0;width:100%;z-index:99999;color:#fff;" +
      "font:26px/30px monospace;margin:0;background:#111;padding:2px 8px;white-space:nowrap";
    doc.body.appendChild(hud);
    self.addEventListener("error", function (ev) {
      self.__bootErr = (self.__bootErr || "") + " " + (ev.message || "?").slice(0, 40);
    });
    hud.textContent = "BOOT-OK";
    setInterval(function () {
      var st = self.AlvidaaWallpaper.state();
      hud.textContent =
        "A" + vm.apps.length + " S" + vm.sources.length +
        " PG" + vm.page + " WP " + (st.current || "-") + "/" + st.timer +
        " K" + (self.AlvidaaWallpaperKind || "-") +
        " PL" + (st.pool || []).length + " LL" + self.AlvidaaWallpaper.list.length +
        " BP" + (doc.body.classList.contains("wp") ? 1 : 0) +
        " ER" + (vid.error ? "E" + vid.error.code : "0") +
        (self.__bootErr ? " X:" + self.__bootErr : "") + "\n" +
        "RS" + vid.readyState + " CT" + (Number(vid.currentTime) || 0).toFixed(1) +
        " V" + vid.videoWidth + "x" + vid.videoHeight +
        " PA" + (vid.paused ? 1 : 0) + " PE" + (self.__playErr || "-") +
        " NN" + doc.getElementsByTagName("*").length;
    }, 500);
  }
}
