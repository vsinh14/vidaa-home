/* Debug prelude — DSH_DEBUG=1 builds only; never ships in a production
 * variant. The launcher's WebView console is not reachable from the host,
 * and the vendor home silently replaces ours when our bundle throws, so
 * the only witness channel is the page itself: an uncaught error paints a
 * red banner that the screenshot/OCR lane can read. */
(function (self) {
  "use strict";
  self.__DBG = {};
  self.__DBG.banner = function (text, color) {
    try {
      var root = self.document.body || self.document.documentElement;
      var old = self.document.getElementById("dbg-banner");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var d = self.document.createElement("div");
      d.id = "dbg-banner";
      d.setAttribute("style", "position:fixed;left:0;top:0;z-index:2147483647;" +
        "background:#000;color:" + color + ";font:40px monospace;padding:8px 16px;");
      d.textContent = String(text).slice(0, 140);
      root.appendChild(d);
    } catch (e) { /* no DOM yet — the error object is still in the log */ }
  };
  self.addEventListener("error", function (ev) {
    var where = "@L" + ev.lineno + ":" + ev.colno;
    var stack = ev.error && ev.error.stack
      ? String(ev.error.stack).split("\n").slice(0, 2).join(" ") : "";
    self.__DBG.banner("JSERR " + ev.message + " " + where + " " + stack, "#ff4040");
  });
}(self));
