/* Debug tail — DSH_DEBUG=1 builds only; never ships. Paints page-visible
 * markers for each boot stage so the screenshot lane can tell which link
 * of the chain broke: EVAL-OK (blue) means every module and the entry
 * evaluated; BOOT-OK (green) means the component mounted; RENDER-ERR
 * (amber) means a render pass threw (the error banner then carries it). */
(function (self) {
  "use strict";
  if (!self.__DBG || !self.AlvidaaNativeComponent) return; // eval/entry threw
  var create = self.AlvidaaNativeComponent;
  self.AlvidaaNativeComponent = function (sdk) {
    var opts = create(sdk);
    var mounted = opts.mounted;
    opts.mounted = function () {
      self.__DBG.banner("BOOT-OK MOUNTED", "#00ff80");
      if (mounted) mounted.apply(this, arguments);
    };
    var render = opts.render;
    opts.render = function (h) {
      try {
        return render.apply(this, arguments);
      } catch (e) {
        self.__DBG.banner("RENDER-ERR " + e.message, "#ffc000");
        throw e;
      }
    };
    // Wallpaper chain truth, 6 s after mount (manifest + refresh have run):
    // manifest script loaded? list populated? sdk installed? which art URL?
    setTimeout(function () {
      try {
        var kit = self.AlvidaaNativeKit;
        var wp = self.AlvidaaWallpaper;
        var list = wp && wp.list ? wp.list.length : -1;
        var sdkS = kit && kit.sdk ? (kit.sdk.storage ? "sdk+storage" : "sdk-nostorage") : "nosdk";
        var art = String(self.AlvidaaNativeWallpaper || "").slice(0, 60);
        var pool = "";
        try { pool = JSON.stringify(wp ? wp.state().pool : null); } catch (e2) { pool = "err"; }
        self.__DBG.banner("WPDBG manifest=" + (self.AlvidaaWallpaperList ? "yes" : "no") +
          " list=" + list + " " + sdkS + " pool=" + pool + " art=" + art, "#ffe040");
      } catch (e) {
        self.__DBG.banner("WPDBG-ERR " + e.message, "#ff4040");
      }
    }, 6000);
    return opts;
  };
  self.__DBG.banner("EVAL-OK HOOK-SET", "#40c0ff");
}(self));
