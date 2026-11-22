/* Alvidaa Native Home — kit bootstrap.
 *
 * Module 00 of the split frontend. The build concatenates the files in
 * native/ in numeric order into one candidate script, so each module is a
 * plain IIFE over a shared namespace: no bundler, no modules-on-TV, one
 * file over the wire. Nothing here touches the DOM; this module owns the
 * constants, the palette, the pure helpers, and the two singletons the
 * other modules read (sdk and its key maps).
 *
 * Design world: teletext page frame. P100 is Home, P110 is Inputs; the
 * type on chrome is a 5x7 pixel font drawn from divs (flat blocks on an
 * even grid survive the 1920-stage -> 4K-panel doubling that real fonts
 * smear through), while list text stays on a real monospace face.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit = self.AlvidaaNativeKit || {};

  // ---- stage geometry (1920x1080 stage units; paint rounds to device px) --
  kit.FAV_MAX = 18;          // pinned cap: 7-up pages, pages need not be full
  kit.LABEL_W = 9;           // label chars fitting the 257 tile's lane at u4
  kit.OVERLAY_LABEL_W = 8;   // the same lane in the 172 drawer tile at u3
  kit.SCROLL_MS = 333;       // marquee step: ~3 chars/s, integer cells stay sharp
  kit.SCROLL_HOLD = 1000;    // head hold before the scroll starts
  kit.ZEN_MS = 5000;         // chrome-free mode 5 s after the lid collapses (owner 2026-11-22)
  kit.KB_COLS = 6;
  kit.KB_CELLS = (function () {
    var cells = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
    cells.push("SPACE", "BACKSPACE", "CLEAR", "DONE");
    return cells;
  })();
  kit.NAME_MAX = 24;
  kit.RECENT_MAX = 40;
  kit.IDLE_STEPS = [0, 1, 5, 15];

  kit.C = (function () {
    // One padding value owns the page borders, and the vertical stack
    // flows from it: every zone is content height + PAD, and the
    // wallpaper band absorbs whatever is left. Nothing black is a fixed
    // bar — the black *is* the content zones. First pass: PAD 24.
    var PAD = 24;
    // Glyph blocks are 7 * unit tall: clock u13 = 91, date/foot u4 = 28.
    var CLOCK_H = 91, DATE_H = 28, FOOT_H = 28, TILE_H = 144;
    var CLOCK_Y = PAD;
    var DATE_Y = CLOCK_Y + CLOCK_H + PAD;
    var FOOT_Y = 1080 - PAD - FOOT_H;
    var RAIL_Y = FOOT_Y - PAD - TILE_H;
    // Inputs split rail: the data row rides ABOVE the ports row, one
    // RAIL_GAP apart. Only the Inputs page ever raises the second row.
    var RAIL2_Y = RAIL_Y - 12 - TILE_H; // 12 = RAIL_GAP, declared below
    // Superblock: starts one PAD (plus the 4px ring margin) above the
    // rail and runs to the bottom edge — rail and foot share one black.
    var SUPER_Y = RAIL_Y - 4 - PAD;
    // Expanded Inputs (two rows): the block grows to cover both.
    var SUPER_EXP_Y = RAIL2_Y - 4 - PAD;
    // Lid closed: the superblock keeps only the foot, one PAD tall band.
    var SUPER_FOOT_Y = FOOT_Y - PAD;
    var BAND_Y = DATE_Y + DATE_H + PAD;   // header scrim zone height
    return {
      PAD: PAD,
      MARGIN: PAD, RIGHT: 1920 - PAD,
      TOP: PAD, BOTTOM: 1080 - PAD,
      CLOCK_Y: CLOCK_Y, DATE_Y: DATE_Y,
      BAND_Y: BAND_Y, SUPER_Y: SUPER_Y,    // chrome zones; the art is full-page
      SUPER_FOOT_Y: SUPER_FOOT_Y,          // superblock with the lid closed
      RAIL_X: PAD, RAIL_Y: RAIL_Y, RAIL2_Y: RAIL2_Y, // data row above ports
      SUPER_EXP_Y: SUPER_EXP_Y,        // superblock, expanded Inputs
      // Tiles sized for a 7-up page: 7x257 + 6x12 = 1871 <= the
      // 1872 the margins leave (was 6x302). The tight-gap design
      // language is kept, so the width gives, not the gap; the
      // height keeps the P100 vertical anchors where they are.
      TILE_W: 257, TILE_H: TILE_H, RAIL_GAP: 12, RAIL_PAGE: 7,
      FOOT_Y: FOOT_Y,
      // The drawer is the rail's grid, scaled: same language, same
      // gap rhythm, so the eye reads one system. 10 x 172 + 9 x 12 =
      // 1828 sits centred inside the margins; rows of 96 wear a 26px
      // gap because the vertical lane carries group labels (u3 sits
      // in the gap, never on a tile). One tile per visible app,
      // rail-sized identity art, the rail's number slot, and the
      // rail's label lane — the owner's "grid of rail components,
      // much smaller to fit more" (2026-11-22).
      OX: 46, OY: 132,                      // overlay grid origin (modal surface)
      OCW: 172, OCH: 96, OGAPX: 12, OGAPY: 26, OCOLS: 10, OPAGE: 70,
      SPX: 360, SPY: 90, SPW: 1200, SPH: 900 // settings panel (modal surface)
    };
  }());

  // ---- palette (Candy pop on a black ground; brand carries the tile) ------
  kit.INK = "#ffffff";
  kit.DIM = "#9aa0a6";
  kit.FAINT = "#555a60";
  kit.CYAN = "#4cc9f0";    // settings values (state surface only)
  kit.AMBER = "#ffb900";   // toast, settings actions (state surface only)
  kit.GREEN = "#35d435";   // live, on-values
  kit.RED = "#d43535";     // edit mode, danger
  kit.YELLOW = "#ffd200";  // chip-only accent
  kit.BLUE = "#35a2ff";    // chip-only accent: launcher settings key
  kit.GRID = "#333333";    // port block border, no signal (green means live)
  kit.MONO = "'DejaVu Sans Mono','Noto Sans Mono','Droid Sans Mono','Courier New',monospace";
  kit.DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  kit.MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // ---- brand fills ---------------------------------------------------------
  // Vivid for the brand-block rail; the luminance guards in tileFill()/
  // inkFor() are what keep a dark brand ("peacock black") from reading as
  // an empty tile and keep the tile's own type legible on it.
  kit.BRANDS = [
    [/netflix/i, "#e50914"],
    [/youtube/i, "#ff0000"],
    [/prime|amazon/i, "#00a8e1"],
    [/crunchyroll/i, "#f47521"],
    [/disney/i, "#113ccf"],
    [/spotify/i, "#1db954"],
    [/plex/i, "#e5a00d"],
    [/apple\s*tv/i, "#7d8590"],
    [/hulu/i, "#1ce783"],
    [/hbo|max\b/i, "#5b2c8d"],
    [/paramount/i, "#0064ff"],
    [/peacock/i, "#7f5af0"],
    [/tubi/i, "#00beb2"],
    [/pluto/i, "#1ad7e5"],
    [/browser/i, "#3b82f6"],
    [/live\s*tv|tv\s*channels/i, "#0093d4"],
    [/settings/i, "#64748b"]
  ];

  // ---- pure helpers --------------------------------------------------------
  kit.p2 = function (n) { return (n < 10 ? "0" : "") + n; };
  kit.hue = function (value) {
    var h = 0, s = String(value || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  };
  kit.brandOf = function (name) {
    var s = String(name || "");
    for (var i = 0; i < kit.BRANDS.length; i++) {
      if (kit.BRANDS[i][0].test(s)) return kit.BRANDS[i][1];
    }
    return "hsl(" + kit.hue(s) + ", 45%, 38%)";
  };
  kit.hexLum = function (hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  // The block colour for a tile: the brand hex when it is strong enough to
  // be a block, a raised hash hue when the brand is near-black. Memoised:
  // the whole tree rebuilds every keypress AND every 333 ms marquee beat,
  // and tileFill is up to 17 regexes plus a char loop per tile per beat —
  // the brand of a name never changes mid-session, so this is arithmetic
  // the model's "decided once" philosophy owes the render path.
  kit.tileFill = (function () {
    var memo = {};
    return function (name) {
      var key = String(name || "");
      var hit = memo[key];
      if (hit !== undefined) return hit;
      var c = kit.brandOf(key);
      var r = (/^#[0-9a-fA-F]{6}$/.test(c) && kit.hexLum(c) < 0.18)
        ? "hsl(" + kit.hue(key) + ", 50%, 42%)" : c;
      memo[key] = r;
      return r;
    };
  })();
  // Black or white for type sitting directly on a block fill. Memoised
  // for the same reason; fills come from a small closed set.
  kit.inkFor = (function () {
    var memo = {};
    return function (fill) {
      var hit = memo[fill];
      if (hit !== undefined) return hit;
      var r = (/^#[0-9a-fA-F]{6}$/.test(fill) && kit.hexLum(fill) > 0.45)
        ? "#000000" : "#ffffff";
      memo[fill] = r;
      return r;
    };
  })();
  kit.signalOf = function (input) {
    var value = input.is_signal != null ? input.is_signal : input.has_signal;
    return value === 1 || value === "1" || value === true;
  };
  // Device presence on a port: `deviceName` is the one field the vendor
  // fills only when a device actually reports itself there (its absence
  // was why HDMI3 read "HDMI3" while a Fire TV was plugged in). The
  // other name fields — displayname2, rename, name — are LABELS the
  // vendor populates for every port, device or not; counting them made
  // every block green on the panel (2026-11-22). Color reads this, the
  // same device-side truth the title already uses.
  kit.deviceOf = function (input) {
    return kit.text(input.deviceName);
  };
  // Rail split truth (owner-locked): the vendor's own label says whether
  // a source is a physical port. The two-letter codes must match as
  // whole tokens, not prefixes — the panel proved why: "SC" is the
  // SCART-era connector, but "SCREEN SHARE" also starts with SC, and
  // a prefix match filed the screen-share data source into the ports
  // row. So: HDMI/COMPONENT as prefixes (no data source starts with
  // them), AV as prefix (no data source collides), and SC only when
  // it IS the connector word: "SC", "SC1", "SCART" — never "SCREEN".
  // Everything else (TV tuner, Chromecast, AirPlay, screen share...)
  // belongs to the data row. Renames never move a source: this reads
  // `name`, and names are not editable.
  kit.isPort = function (input) {
    return /^(HDMI|COMPONENT|AV|SC$|SC[0-9]|SCART)/i.test(kit.text(input.name));
  };
  kit.text = function (value) { return typeof value === "string" ? value.trim() : ""; };
  kit.isTruthy = function (val) {
    return val === true || val === "true" || val === 1 || val === "1";
  };
  kit.inAppList = function (list, app) {
    if (!Array.isArray(list) || !list.length) return false;
    var id = String(app.appId).toLowerCase();
    var name = (app.appName || "").trim().toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var item = String(list[i]).trim().toLowerCase();
      if (item === id || (name && item === name)) return true;
    }
    return false;
  };
  // One-word labels: "Spotify: Music and Podcasts" shows as "Spotify".
  // Matching still runs on the full name (pin/hide/launch unaffected).
  kit.shortName = function (name) {
    var t = String(name || "").trim();
    var m = t.split(/[\s:]/)[0];
    return m || t;
  };
  // The tile label rule, in ONE place (owner, 2026-11-22): an
  // unselected block shows one WORD — the first word of the name,
  // as it always has. The block the ring rests on shows the FULL
  // name after a one-second beat in the same word, static when
  // 11 chars fill the lane, scrolling through the whole name when
  // it runs past them. Returns { word, full }.
  kit.tileLabel = function (full, word) {
    var f = String(full == null ? "" : full).toUpperCase();
    var w = String(word == null ? "" : word).toUpperCase();
    if (!w) w = kit.shortName(f);
    return { word: w, full: f };
  };
  // The focused block's label lane, ONCE (review, 2026-11-22): the
  // rail and the drawer are the same language, and two verbatim
  // copies of this hold-then-walk block — each with its own lane
  // width pasted in — was the tree's biggest drift vector: the
  // guard's lane (scrollActive) and the paint's lane must agree or
  // a word sticks forever / a repaint loop spins, the exact
  // Crunchyroll class of bug. Painters pass their own unit/LW/x/y;
  // only the algorithm lives here.
  kit.labelPaint = function (P, vm, L, ink, x, y, unit, LW) {
    var lab = L.full || L.word;
    var el = kit.phaseMs(vm);
    // The settling beat belongs to the RING: a fresh selection
    // reads as its one word (its head, when even the word runs
    // past the lane) for the first second whatever the length is.
    if (el <= kit.SCROLL_HOLD)
      return P.pxText(L.word.slice(0, LW), unit, ink, x, y);
    if (lab.length <= LW) return P.pxText(lab, unit, ink, x, y);
    // Past the beat: one char per step through the padded name
    // and back to the head. Integer cells only.
    var cyc = lab + " ", per = cyc.length;
    var st = Math.floor((el - kit.SCROLL_HOLD) / kit.SCROLL_MS);
    st = ((st % per) + per) % per;
    var win = "";
    for (var w = 0; w < LW; w++) win += cyc.charAt((st + w) % per);
    return P.pxText(win, unit, ink, x, y);
  };
  // chip + word pair, and where the next pair starts — the 32-gap
  // rhythm of the foot legend, in one place (two renderers hand-
  // rolled it).
  kit.chipWord = function (P, x, y, color, word) {
    return {
      nodes: [P.chip(x, y + 3, color)]
        .concat(P.pxText(word, 4, kit.INK, x + 32, y)),
      next: x + 32 + P.textWidth(word, 4) + 32
    };
  };
  // The right-hand cue slot of the teletext frame, in one place
  // (three callers hand-rolled the RIGHT - textWidth arithmetic).
  kit.rightFoot = function (P, text, color, y) {
    return P.pxText(text, 4, color,
      kit.C.RIGHT - P.textWidth(text, 4), y);
  };

  // Marquee phase, ONE source of truth (owner, 2026-11-22, after the
  // Crunchyroll drift): the beat clock is not stamped by whoever
  // mutates the selection — that was a convention every nav path
  // had to honour, and paths that changed page or lane quietly (or
  // names where the one word IS the whole name, like Crunchyroll)
  // drifted. Instead the clock starts the first time a CONSUMER
  // (the render painting the ring, or the repaint guard) sees a
  // new selection identity. Both ask the same function, so paint
  // and guard can never disagree, and no mutation site can forget.
  kit.selKey = function (vm) {
    // The drawer is its own lane: the beat clock restarts when focus
    // moves inside the grid, and a home beat never leaks into it.
    if (vm.overlay) return (vm._phaseGen || 0) + "|a" + vm.overlayIndex;
    var lane = vm.page === "inputs"
      ? "i" + (vm.inputRow ? "p" + vm.inputSel : "d" + vm.inputDataSel)
      : "h" + vm.fav;
    return (vm._phaseGen || 0) + "|" + lane;
  };
  kit.phaseMs = function (vm) {
    var now = Date.now(), k = kit.selKey(vm);
    if (!vm._phase || vm._phase.key !== k) vm._phase = { key: k, t0: now };
    return now - vm._phase.t0;
  };

  // Zen contrast: the sampled ink picks white or black against the
  // wallpaper patch behind the clock, and the halo is ALWAYS the
  // opposite — the guarantee holds even on a mid-grey patch and in
  // the halo-only fallback when the panel refuses canvas reads.
  kit.haloFor = function (ink) {
    return String(ink).toLowerCase() === "#000000"
      ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)";
  };

  // Sample the wallpaper where the clock and date sit. The image is
  // painted cover/center on the 1920x1080 stage, so the stage rect
  // is mapped back through the same cover math into image pixels.
  // Any failure (no Image, tainted canvas, missing file) is simply
  // no result — the caller keeps the white halo-only default.
  kit.sampleWallpaperInk = function (cb) {
    if (typeof self.Image !== "function" || !self.document ||
        !self.AlvidaaNativeWallpaper) return false;
    try {
      var img = new self.Image();
      img.onload = function () {
        try {
          var gw = 32, gh = 16;
          var cv = self.document.createElement("canvas");
          cv.width = gw; cv.height = gh;
          var g = cv.getContext && cv.getContext("2d");
          if (!g || !img.width || !img.height) return;
          var sc = Math.max(1920 / img.width, 1080 / img.height);
          var ox = (1920 - img.width * sc) / 2, oy = (1080 - img.height * sc) / 2;
          var x0 = C.MARGIN - 8, y0 = C.CLOCK_Y - 8;
          var x1 = C.MARGIN + 380, y1 = C.DATE_Y + 40;
          var sx = Math.max(0, Math.floor((x0 - ox) / sc));
          var sy = Math.max(0, Math.floor((y0 - oy) / sc));
          var sw = Math.max(1, Math.min(img.width - sx, Math.ceil((x1 - x0) / sc)));
          var sh = Math.max(1, Math.min(img.height - sy, Math.ceil((y1 - y0) / sc)));
          g.drawImage(img, sx, sy, sw, sh, 0, 0, gw, gh);
          var d = g.getImageData(0, 0, gw, gh).data;
          var sum = 0, n = d.length / 4, i;
          for (i = 0; i < d.length; i += 4) {
            sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          }
          cb(sum / n > 140 ? "#000000" : "#ffffff");
        } catch (e) { void e; /* tainted or unsupported: fallback stands */ }
      };
      img.src = self.AlvidaaNativeWallpaper;
      return true;
    } catch (e) { void e; return false; }
  };
  kit.trunc = function (value, n) {
    var t = String(value == null ? "" : value);
    return t.length > n ? t.slice(0, n) : t;
  };
  // Flat translucent black for the chrome zones over full-page art.
  // One alpha, one colour, no gradients: the art just reads through.
  // SCRIM dresses the header; SUPER is the near-black superblock that
  // carries the rail and the foot as one unit — the apps' own block.
  kit.SCRIM = "rgba(0,0,0,0.6)";
  kit.SUPER = "rgba(0,0,0,0.85)";
  // Silence that closes the rail's lid (the heartbeat samples at 1 s).
  kit.RAIL_LID_MS = 30000;

  kit.wallpaperStyle = function () {
    var wp = self.AlvidaaNativeWallpaper;
    return {
      backgroundColor: "#000000",
      backgroundImage: wp ? "url('" + wp + "')" : "none",
      backgroundSize: "cover",
      backgroundPosition: "center"
    };
  };
  kit.merge = function (target) {
    for (var a = 1; a < arguments.length; a++) {
      var src = arguments[a];
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
      }
    }
    return target;
  };

  // ---- sdk singletons ------------------------------------------------------
  // One launcher component per page, created once by native-entry.js, so a
  // module-level handle is enough for every module; create() installs it.
  kit.sdk = null;
  kit.readPref = function (key, fallback) {
    var sdk = kit.sdk;
    if (!sdk || !sdk.storage || typeof sdk.storage.get !== "function") return fallback;
    try {
      var raw = sdk.storage.get(key);
      if (raw === undefined || raw === null) return fallback;
      if (typeof raw === "string") {
        try {
          var parsed = JSON.parse(raw);
          return parsed !== undefined && parsed !== null ? parsed : fallback;
        } catch (_) {
          return raw;
        }
      }
      return raw;
    } catch (_) {
      return fallback;
    }
  };
  kit.writePref = function (key, val) {
    var sdk = kit.sdk;
    if (!sdk || !sdk.storage || typeof sdk.storage.set !== "function") return;
    try {
      sdk.storage.set(key, JSON.stringify(val));
    } catch (_) {}
  };

  // Key maps from the vendor KEYMAP, plus the color-key wiring this TV has
  // no proof of: named codes first, raw 182/183/184 as the unverified
  // fallback (must be re-tested against the bridge's key injection).
  kit.keys = {};
  kit.numKeys = {};
  kit.colorKeys = {};
  kit.menuKey = null;
  kit.installKeys = function (sdk) {
    kit.sdk = sdk;
    var k = (sdk && sdk.key && sdk.key.KEYMAP) || {};
    kit.keys = k;
    var num = {};
    for (var d = 0; d <= 9; d++) {
      if (k["NUM_" + d] != null) num[k["NUM_" + d]] = d;
    }
    kit.numKeys = num;
    var cm = {};
    var named = ["RED", "GREEN", "YELLOW", "BLUE", "COLOR_RED", "COLOR_GREEN", "COLOR_YELLOW", "COLOR_BLUE",
      "KEY_RED", "KEY_GREEN", "KEY_YELLOW", "KEY_BLUE"];
    for (var i = 0; i < named.length; i++) {
      if (k[named[i]] != null && !cm[k[named[i]]]) {
        cm[k[named[i]]] = named[i].replace(/^(COLOR_|KEY_)/, "").toLowerCase();
      }
    }
    var raw = { 182: "red", 183: "green", 184: "yellow", 185: "blue" };
    Object.keys(raw).forEach(function (code) {
      var n = Number(code);
      if (cm[n] == null) cm[n] = raw[code];
    });
    kit.colorKeys = cm;
    kit.menuKey = k.MENU != null ? k.MENU : null;
  };
}(self));
