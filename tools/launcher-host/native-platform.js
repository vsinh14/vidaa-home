/* Native VIDAA data adapter. No browser/bridge transport.
 * Not wired into the installed N02 module: see FREE-MY-TV-NATIVE-PORT.md.
 * Contracts are source-verified; hardware validation is still required.
 */
(function (root) {
  "use strict";
  // Owner-curated tiles that are NOT VIDAA packages (2026-11-24): the
  // registry can never list them, so they are appended here after the
  // registry read and launched through the vendor's own browser lane
  // (appId 16 "Browser" from /api/apps; typeCode 8002 = sF.H5, startMethod
  // LAUNCHER_RECOMMEND — exactly the vendor browserItemClick shape).
  //   jellyfin  — LAN Jellyfin server (mari, 192.168.0.99:8096)
  //   moonlight — the runtime's self-hosted player page (127.0.0.1:8870):
  //               same-origin /api/moonlight/* gives it pairing, the app
  //               list and Start; the runtime auto-starts at boot via the
  //               bridge wrapper, so the tile is home whenever the TV is.
  var WEB_TILES = [
    { appId: "jellyfin", appName: "Jellyfin",
      url: "http://192.168.0.99:8096/web/index.html" },
    { appId: "moonlight", appName: "Moonlight",
      url: "http://127.0.0.1:8870/moonlight.html" }
  ];
  var BROWSER_APP_ID = "16", BROWSER_TYPE_CODE = "8002";
  // The app-like surface is the bridge's /api/open: it publishes the remote
  // ui_service launchapp action (storeType custom), which opens a chromeless
  // web-app window for ANY http url — the same lane the fork launcher's
  // tiles and the runtime's moonlight page always used. The stock browser
  // (typeCode 8002) stays as the fallback so a blocked fetch degrades to
  // the browser with chrome, never to a dead tile.
  var BRIDGE_OPEN = "http://127.0.0.1:8770/api/open?url=";
  function browserStart(sdk, tile) {
    return sdk.apc.start({ name: tile.appName, appId: BROWSER_APP_ID,
      url: tile.url,
      startMethod: (sdk.apc.CMDMETHOD && sdk.apc.CMDMETHOD.LAUNCHER_RECOMMEND) ||
        sdk.apc.CMDMETHOD.REMOTECONTROL,
      typeCode: BROWSER_TYPE_CODE });
  }
  function launchWebTile(sdk, tile) {
    var request;
    try {
      request = fetch(BRIDGE_OPEN + encodeURIComponent(tile.url), { mode: "no-cors" });
    } catch (_) {
      return browserStart(sdk, tile);
    }
    // no-cors hides the body, but a resolve still proves the request was
    // delivered; a reject (blocked/refused) falls back to the browser.
    request.then(function () {}, function () { browserStart(sdk, tile); });
    return request;
  }
  function webTile(appId) {
    for (var i = 0; i < WEB_TILES.length; i++) {
      if (String(WEB_TILES[i].appId) === String(appId)) return WEB_TILES[i];
    }
    return null;
  }
  function createNativePlatform(sdk, onUpdate) {
    var events = [
      "o2n://sdk/init-finished",
      "o2n://app-service/all-apps-changed",
      "o2n://all-inputs/inputs-data-changed",
      "o2n://sdk/str-resuming"
    ];
    var delays = [250, 500, 1000, 2000, 4000, 8000];
    var apps = [], sources = [], running = false, reading = false, timer = null, attempt = 0;

    function readList(module, key, argument) {
      var response = sdk.me.req(module).getData(key, argument);
      if (!response || !Array.isArray(response.result)) {
        throw new Error(module + "." + key + " did not return a list");
      }
      return response.result.slice();
    }
    function cancelTimer() {
      clearTimeout(timer);
      timer = null;
    }
    function refresh() {
      if (!running) return;
      cancelTimer();
      var errors = [];
      reading = true;
      // Keep the last good list on a failed read, but accept a successful empty
      // list (e.g. all apps removed). One failed service must not hide the other.
      try { apps = readList("app-service", "getAppList", { sceneCode: "launcher" }); }
      catch (error) { errors.push("Apps: " + error.message); }
      // The web tiles ride every refresh: registry entries never carry
      // them, and the synthetic ids must survive the registry's own churn.
      if (apps.length) {
        for (var wi = 0; wi < WEB_TILES.length; wi++) {
          (function (tile) {
            var present = apps.some(function (app) {
              return String(app.appId) === tile.appId;
            });
            if (!present) apps.push({ appId: tile.appId, appName: tile.appName, url: tile.url });
          })(WEB_TILES[wi]);
        }
      }
      try { sources = readList("all-inputs", "getAllInputsData"); }
      catch (error) { errors.push("Inputs: " + error.message); }
      reading = false;
      var waiting = errors.length > 0 || apps.length === 0 || sources.length === 0;
      var retrying = waiting && attempt < delays.length;
      if (retrying) timer = setTimeout(refresh, delays[attempt++]);
      onUpdate({ apps: apps.slice(), sources: sources.slice(), errors: errors,
        waiting: waiting, retrying: retrying });
    }
    function changed() {
      if (!running || reading) return;
      // Coalesce notifications. Ignore synchronous notifications caused by our
      // own reads: otherwise lazy initialization can reset the retry budget.
      attempt = 0;
      cancelTimer();
      timer = setTimeout(refresh, 0);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelTimer();
      events.forEach(function (event) { sdk.message.off(event, changed); });
    }
    return {
      start: function () {
        if (running) return;
        running = true;
        attempt = 0;
        try {
          events.forEach(function (event) { sdk.message.on(event, changed); });
          refresh();
        } catch (error) { stop(); throw error; }
      },
      stop: stop,
      refresh: changed,
      openSettings: function () {
        return sdk.me.req("setting").open("settings", { vk: "T" });
      },
      launchApp: function (appId) {
        var tile = webTile(appId);
        if (tile) return launchWebTile(sdk, tile);
        if (!apps.some(function (app) { return app && String(app.appId) === String(appId); })) {
          throw new Error("App is not in the current native app list");
        }
        var response = sdk.me.req("app-service").getData("getAppInfo",
          { appId: String(appId), url: "", checkRange: 1 });
        var app = response && response.result;
        if (!app || String(app.appId) !== String(appId)) throw new Error("App is unavailable or restricted");
        // APC owns parental PIN, EULA and hotel-mode checks. Never propagate
        // bypass flags from a UI record or invoke the lower-level app service.
        return sdk.apc.start({ name: app.appName || "", appId: app.appId,
          url: app.url || "", storeType: app.storeType,
          startMethod: sdk.apc.CMDMETHOD.REMOTECONTROL, typeCode: "600002" });
      },
      changeSource: function (sourceId) {
        var validId = (typeof sourceId === "string" && sourceId.trim() !== "") ||
          (typeof sourceId === "number" && isFinite(sourceId));
        if (!validId || !sources.some(function (source) { return source && source.sourceId === sourceId; })) {
          throw new Error("Input is not in the current native source list");
        }
        return sdk.me.req("all-inputs").invoke("changeSourceTo", sourceId, "launcher");
      }
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = createNativePlatform;
  else root.AlvidaaNativePlatform = createNativePlatform;
}(typeof self !== "undefined" ? self : this));
