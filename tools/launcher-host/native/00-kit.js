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
  kit.FAV_MAX = 18;          // three rail blocks of six
  kit.KB_COLS = 6;
  kit.KB_CELLS = (function () {
    var cells = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
    cells.push("SPACE", "BACKSPACE", "CLEAR", "DONE");
    return cells;
  })();
  kit.NAME_MAX = 24;
  kit.RECENT_MAX = 40;
  kit.IDLE_STEPS = [0, 1, 5, 15];

  kit.C = {
    MARGIN: 128, RIGHT: 1792,
    BAND_Y: 232, BAND_H: 400,             // the wallpaper band
    RAIL_X: 128, RAIL_Y: 824,
    TILE_W: 208, TILE_H: 144, RAIL_GAP: 16, RAIL_PAGE: 6,
    FOOT_Y: 1004,
    INP_X: 128, INP_Y: 400, INP_GAPX: 16, INP_GAPY: 20, INP_COLS: 6, INP_PAGE: 12,
    OX: 220, OY: 180,                      // overlay grid origin
    OCW: 196, OCH: 110, OGAPX: 18, OGAPY: 24, OCOLS: 7, OPAGE: 35,
    SPX: 360, SPY: 90, SPW: 1200, SPH: 900 // settings panel
  };

  // ---- palette (Candy pop on a black ground; brand carries the tile) ------
  kit.INK = "#ffffff";
  kit.DIM = "#9aa0a6";
  kit.FAINT = "#555a60";
  kit.CYAN = "#4cc9f0";    // page numbers
  kit.AMBER = "#ffb900";   // cues, toast, countdown
  kit.GREEN = "#35d435";   // live, on-values
  kit.RED = "#d43535";     // edit mode, danger
  kit.YELLOW = "#ffd200";  // chip-only accent
  kit.GRID = "#333333";    // unfocused tile border
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
  // be a block, a raised hash hue when the brand is near-black.
  kit.tileFill = function (name) {
    var c = kit.brandOf(name);
    if (/^#[0-9a-fA-F]{6}$/.test(c) && kit.hexLum(c) < 0.18) {
      return "hsl(" + kit.hue(String(name || "")) + ", 50%, 42%)";
    }
    return c;
  };
  // Black or white for type sitting directly on a block fill.
  kit.inkFor = function (fill) {
    if (/^#[0-9a-fA-F]{6}$/.test(fill) && kit.hexLum(fill) > 0.45) return "#000000";
    return "#ffffff";
  };
  kit.signalOf = function (input) {
    var value = input.is_signal != null ? input.is_signal : input.has_signal;
    return value === 1 || value === "1" || value === true;
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
  kit.trunc = function (value, n) {
    var t = String(value == null ? "" : value);
    return t.length > n ? t.slice(0, n) : t;
  };
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
    var named = ["RED", "GREEN", "YELLOW", "COLOR_RED", "COLOR_GREEN", "COLOR_YELLOW",
      "KEY_RED", "KEY_GREEN", "KEY_YELLOW"];
    for (var i = 0; i < named.length; i++) {
      if (k[named[i]] != null && !cm[k[named[i]]]) {
        cm[k[named[i]]] = named[i].replace(/^(COLOR_|KEY_)/, "").toLowerCase();
      }
    }
    var raw = { 182: "red", 183: "green", 184: "yellow" };
    Object.keys(raw).forEach(function (code) {
      var n = Number(code);
      if (cm[n] == null) cm[n] = raw[code];
    });
    kit.colorKeys = cm;
    kit.menuKey = k.MENU != null ? k.MENU : null;
  };
}(self));
