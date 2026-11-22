/* Page platform adapter.
 *
 * Same factory signature as the vendor platform (AlvidaaNativePlatform
 * (sdk, onUpdate) -> { start, stop, refresh, launchApp, changeSource,
 * openSettings }), but the data plane is the alvidaa bridge's /ws relay
 * instead of the VRE service bus. The bridge is the only MQTT client on
 * this box, so the page never touches MQTT directly.
 *
 * Wire schema (probed live 2026-11-23): inbound hello{apps,sources,
 * installed}, apps, sources, {ok:false,error}; outbound {t:"launch",
 * name}, {t:"source", id}. Bridge apps are {appId,icon,name}; sources
 * are {id,name,signal,...}. The modules want appName (not name),
 * sourceId (not id) and is_signal truth via kit.signalOf, so map here
 * and keep the modules untouched.
 */
(function (self) {
  "use strict";

  self.AlvidaaNativePlatform = function (sdk, onUpdate) {
    var ws = null, running = false, timer = null;
    var apps = [], sources = [], byApp = {};
    var delays = [0, 1500, 3000, 6000, 12000, 20000], attempt = 0;

    function mapApp(a) {
      return {
        appId: String(a.appId != null ? a.appId : ""),
        appName: typeof a.name === "string" ? a.name : "",
        icon: a.icon || ""
      };
    }
    function mapSource(s) {
      var sid = String(s.id != null ? s.id : "");
      var name = (typeof s.name === "string" && s.name.trim()) || sid;
      // The bridge fills `name` with the attached device label when one
      // reports itself (HDMI3 -> "JBL Bar800M2"); for empty ports the
      // name equals the port id. deviceOf() reads deviceName, so split
      // the two here exactly the vendor adapter would.
      var device = name !== sid &&
        /^(HDMI|COMPONENT|AV|SC$|SC[0-9]|SCART)/i.test(name) ? name : "";
      return {
        sourceId: sid, _bid: sid,
        name: sid, deviceName: device,
        is_signal: s.signal ? 1 : 0
      };
    }
    function publish(errors) {
      onUpdate({
        apps: apps.slice(), sources: sources.slice(),
        errors: errors || [],
        waiting: !apps.length && !sources.length, retrying: !!timer
      });
    }
    function schedule() {
      if (!running || timer) return;
      var d = delays[Math.min(attempt, delays.length - 1)];
      attempt++;
      timer = self.setTimeout(open, d);
    }
    function open() {
      timer = null;
      if (!running || ws) return;
      var sock;
      try {
        sock = new WebSocket((self.location.protocol === "https:" ? "wss://" : "ws://") +
          self.location.host + "/ws");
      } catch (error) { schedule(); return; }
      ws = sock;
      sock.onopen = function () { attempt = 0; };
      sock.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (Array.isArray(m.apps)) {
          apps = m.apps.map(mapApp);
          byApp = {};
          apps.forEach(function (a) { byApp[a.appId] = a; });
        }
        if (Array.isArray(m.sources)) sources = m.sources.map(mapSource);
        if (m.ok === false) publish([m.error || "Action failed"]);
        else if (m.t === "hello" || m.t === "apps" || m.t === "sources") publish([]);
      };
      sock.onclose = function () { ws = null; schedule(); };
      sock.onerror = function () { try { sock.close(); } catch (_) {} };
    }
    function send(obj) {
      if (!ws || ws.readyState !== 1) throw new Error("TV link offline");
      ws.send(JSON.stringify(obj));
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        attempt = 0;
        if (ws) { try { ws.close(); } catch (_) {} ws = null; }
        open();
      },
      stop: function () {
        running = false;
        if (timer) { self.clearTimeout(timer); timer = null; }
        if (ws) { try { ws.close(); } catch (_) {} ws = null; }
      },
      refresh: function () {
        if (!running) return;
        if (timer) { self.clearTimeout(timer); timer = null; }
        attempt = 0;
        if (ws) { try { ws.close(); } catch (_) {} ws = null; }
        open();
      },
      launchApp: function (appId) {
        var app = byApp[String(appId)];
        if (!app) throw new Error("App is not in the current app list");
        send({ t: "launch", name: app.appName });
        return Promise.resolve();
      },
      changeSource: function (sourceId) {
        var sid = String(sourceId);
        var known = sources.some(function (s) { return s._bid === sid; });
        if (!known) throw new Error("Input is not in the current input list");
        send({ t: "source", id: sid });
        return Promise.resolve();
      },
      openSettings: function () {
        return Promise.reject(new Error("TV settings are not wired on the page lane yet"));
      }
    };
  };
}(self));
