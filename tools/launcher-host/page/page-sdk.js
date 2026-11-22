/* Page SDK shim.
 *
 * The native modules (00-kit … 80-component) consume the vendor VRE SDK
 * through a very small surface: storage.get/set, i18n.t, router, tts and
 * key.KEYMAP. This file fakes that surface for a plain Chromium page (the
 * Odin store-app window), so the modules run unmodified. Anything not on
 * that surface is intentionally absent: a module reaching for more is a
 * porting bug we want to see, not paper over.
 */
(function (self) {
  "use strict";

  function safeGet(key) {
    try { return self.localStorage.getItem("alvidaa:" + key); }
    catch (_) { return null; }
  }
  function safeSet(key, val) {
    try { self.localStorage.setItem("alvidaa:" + key, val); }
    catch (_) {}
  }

  self.AlvidaaPageSDK = function () {
    return {
      storage: {
        // kit.writePref JSON.stringifies before set; kit.readPref parses
        // strings. So the shim only ever needs to carry strings.
        get: function (key) {
          var raw = safeGet(key);
          return raw === null ? undefined : raw;
        },
        set: function (key, val) { safeSet(key, String(val)); }
      },
      i18n: {
        // The vendor i18n lookup exists only to translate port codes
        // (HDMI1 -> the localized connector word). On the page lane we
        // show the vendor label as-is.
        t: function (key) { return key; }
      },
      router: {
        isCurrentPathEqualTo: function (path) { return path === "/Launcher"; }
      },
      tts: {
        isEnable: function () { return false; },
        speak: function () {},
        stop: function () {}
      },
      key: {
        // Browser keyCode contract from the remote, proven on this panel
        // in the fork lane. Back arrives as several different codes; the
        // host listener normalizes them all to BACK before calling
        // handleKey, so the KEYMAP only lists the canonical one.
        KEYMAP: {
          UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13,
          BACK: 461, OK: 13,
          RED: 182, GREEN: 183, YELLOW: 184, BLUE: 185,
          MENU: 138, INFO: 138,
          NUM_0: 48, NUM_1: 49, NUM_2: 50, NUM_3: 51, NUM_4: 52,
          NUM_5: 53, NUM_6: 54, NUM_7: 55, NUM_8: 56, NUM_9: 57
        }
      }
    };
  };
}(self));
