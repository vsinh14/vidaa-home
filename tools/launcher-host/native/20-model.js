/* Module 20 — the data model.
 *
 * Every method here is pure component state: reading vendor payloads into
 * apps/sources, applying the owner's preferences, and answering "what is
 * the focused row right now". No DOM, no keys. Bodies are carried over
 * from the pre-split frontend verbatim except where the page frame made
 * the three-row zone model obsolete (favorites live on P100, inputs on
 * P110; the door tiles are gone, replaced by color keys and cues).
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;
  var C = kit.C;

  kit.model = {
    data: function () {
      return {
        apps: [], sources: [],
        // The page frame: "home" (P100) and "inputs" (P110). edit is the
        // rail's remove-mode entered with the RED key.
        page: "home", fav: 0, edit: false, inputSel: 0,
        overlay: false, overlayIndex: 0,
        settings: false, settingsPage: "root", settingsIndex: 0,
        nameDraft: "", nameIndex: 0, nameSourceId: null,
        now: new Date(), width: self.innerWidth || 1920,
        toast: "", toastUntil: 0,
        idle: false, idleAt: 0, idleFade: 1,
        autoSwitchId: null, autoSwitchName: "", autoSwitchAt: 0,
        prefs: {
          hiddenApps: [], onlyApps: [], customNames: {}, lastUsed: null,
          autoSwitch: false, recentOrder: true, recent: {}, favorites: [],
          idleMinutes: 0, groups: []
        }
      };
    },
    methods: {
      readPrefs: function () {
        this.prefs = {
          hiddenApps: kit.readPref("alvidaa_hidden_apps", []),
          onlyApps: kit.readPref("alvidaa_only_apps", []),
          customNames: kit.readPref("alvidaa_custom_names", {}),
          lastUsed: kit.readPref("alvidaa_last_used", null),
          autoSwitch: kit.isTruthy(kit.readPref("alvidaa_auto_switch", false)),
          recentOrder: kit.isTruthy(kit.readPref("alvidaa_recent_order", true)),
          recent: kit.readPref("alvidaa_recent", {}),
          favorites: kit.readPref("alvidaa_favorites", []),
          idleMinutes: Number(kit.readPref("alvidaa_idle_minutes", 0)) || 0,
          groups: kit.readPref("alvidaa_groups", [])
        };
        if (this._lastData && this._lastData.apps) {
          this.apps = this.sortRecent(this.filterApps(this._lastData.apps));
        }
        this.clamp();
      },
      filterApps: function (apps) {
        var vm = this;
        var hidden = vm.prefs && vm.prefs.hiddenApps;
        var only = vm.prefs && vm.prefs.onlyApps;
        return (apps || []).filter(function (app) {
          if (!app || app.appId == null || !kit.text(app.appName)) return false;
          var aid = String(app.appId);
          if (aid === "vidaa-home" || aid === "206") return false;
          if (Array.isArray(only) && only.length) {
            return kit.inAppList(only, app);
          }
          if (Array.isArray(hidden) && hidden.length) {
            return !kit.inAppList(hidden, app);
          }
          return true;
        });
      },
      // Recently-used ordering (issue #55): the overlay lists launched apps
      // newest-first, from alvidaa_recent. Apps with no record keep their
      // existing relative order behind the recorded ones — the ranking is
      // written out by original index instead of trusting Array#sort to be
      // stable (older engines in this family are not).
      sortRecent: function (apps) {
        var recent = this.prefs && this.prefs.recent;
        if (!this.prefs || !this.prefs.recentOrder || !recent ||
            typeof recent !== "object" || Array.isArray(recent)) return apps;
        var ranked = [];
        for (var i = 0; i < apps.length; i++) {
          ranked.push({
            app: apps[i],
            at: Number(recent[String(apps[i].appId)]) || 0,
            index: i
          });
        }
        ranked.sort(function (a, b) {
          if (a.at !== b.at) return b.at - a.at; // newest first
          return a.index - b.index;             // vendor order within a group
        });
        // Copy through concat(), not [], so the result stays in the same
        // realm as the list it re-orders (the test harness runs the
        // component in a vm and compares its arrays against host ones).
        var out = apps.concat();
        for (var j = 0; j < ranked.length; j++) out[j] = ranked[j].app;
        return out;
      },
      sourceName: function (input) {
        // Custom names override vendor values: sourceId -> name/displayname2/rename.
        var custom = this.prefs && this.prefs.customNames;
        if (custom && typeof custom === "object") {
          var sid = input.sourceId != null ? String(input.sourceId) : "";
          if (sid && kit.text(custom[sid])) return kit.text(custom[sid]);
          var names = [input.name, input.deviceName, input.displayname2, input.rename];
          for (var k = 0; k < names.length; k++) {
            var val = kit.text(names[k]);
            if (!val) continue;
            if (kit.text(custom[val.toLowerCase()])) return kit.text(custom[val.toLowerCase()]);
            if (kit.text(custom[val])) return kit.text(custom[val]);
          }
        }
        // Same order as the bridge, but the field names differ by transport:
        // the vendor JS SDK reports the device as `deviceName`, while the
        // MQTT sourcelist the bridge reads calls it `displayname2`. Missing
        // `deviceName` was why HDMI3 still read "HDMI3" on the native Home
        // while the canvas lane showed "Fire TV Stick" (2026-11-10).
        var label = kit.text(input.deviceName) || kit.text(input.displayname2) ||
          kit.text(input.rename) || kit.text(input.name) || String(input.sourceId);
        var sdk = kit.sdk;
        if (/^[A-Z]{2,4}[0-9]{4,}$/.test(label) && sdk && sdk.i18n && sdk.i18n.t) {
          try {
            var translated = sdk.i18n.t(label);
            if (translated && translated !== label) return translated;
          } catch (_) { return kit.text(input.name) || label; }
          return kit.text(input.name) || label;
        }
        return label;
      },
      smartIndex: function () {
        // Smart focus: the first live source, else the last-used port.
        var live = this.sources.filter(kit.signalOf);
        if (live.length) {
          for (var i = 0; i < this.sources.length; i++) {
            if (this.sources[i] === live[0]) return i;
          }
        }
        var last = this.prefs && this.prefs.lastUsed;
        if (last != null && this.sources.length) {
          var lastStr = String(last);
          for (var j = 0; j < this.sources.length; j++) {
            if (String(this.sources[j].sourceId) === lastStr) return j;
          }
        }
        return 0;
      },
      // Rail on P100: the pinned favorites in pin order, capped at FAV_MAX.
      // The block colour and its ink are decided once per list build, so
      // render stays arithmetic.
      favoriteItems: function () {
        var items = [];
        var favs = (this.prefs && this.prefs.favorites) || [];
        if (Array.isArray(favs)) {
          var seen = {};
          for (var i = 0; i < favs.length && items.length < kit.FAV_MAX; i++) {
            var favId = String(favs[i]);
            if (seen[favId]) continue;
            seen[favId] = true;
            var app = null;
            for (var j = 0; j < this.apps.length; j++) {
              if (String(this.apps[j].appId) === favId) {
                app = this.apps[j];
                break;
              }
            }
            if (app) {
              var fill = kit.tileFill(app.appName);
              items.push({
                kind: "favorite",
                appId: app.appId,
                app: app,
                label: kit.shortName(app.appName),
                fill: fill,
                ink: kit.inkFor(fill)
              });
            }
          }
        }
        return items;
      },
      // --- groups in the apps overlay (issue #57) ---------------------------
      // alvidaa_groups is an owner-curated array of { name, apps: [appId…] }
      // in sdk.storage; first group to claim an app wins, everything left
      // over lands in "Other apps". Unset config means the flat grid.
      appById: function (id) {
        var key = String(id);
        for (var i = 0; i < this.apps.length; i++) {
          if (String(this.apps[i].appId) === key) return this.apps[i];
        }
        return null;
      },
      overlayGroups: function () {
        var config = this.prefs && this.prefs.groups;
        if (!Array.isArray(config) || !config.length) return null;
        var lists = [], claimed = {};
        for (var i = 0; i < config.length; i++) {
          var entry = config[i];
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
          if (!kit.text(entry.name)) continue;
          var ids = Array.isArray(entry.apps) ? entry.apps : [];
          var apps = [];
          for (var j = 0; j < ids.length; j++) {
            var app = this.appById(ids[j]);
            if (app && !claimed[String(app.appId)]) {
              claimed[String(app.appId)] = true;
              apps.push(app);
            }
          }
          if (apps.length) lists.push({ name: kit.text(entry.name), apps: apps });
        }
        var rest = [];
        for (var k = 0; k < this.apps.length; k++) {
          if (!claimed[String(this.apps[k].appId)]) rest.push(this.apps[k]);
        }
        if (rest.length) lists.push({ name: "Other apps", apps: rest });
        return lists.length ? lists : null;
      },
      overlayList: function () {
        var groups = this.overlayGroups();
        if (!groups) return this.apps;
        // Anchor on this.apps so the flattened list stays in the same realm
        // as the list it re-orders (see sortRecent: realm-sensitive harness).
        var out = this.apps.slice(0, 0);
        for (var i = 0; i < groups.length; i++) out = out.concat(groups[i].apps);
        return out;
      },
      overlaySpans: function () {
        var groups = this.overlayGroups();
        if (!groups) return null;
        var spans = [], start = 0;
        for (var i = 0; i < groups.length; i++) {
          spans.push({ name: groups[i].name, start: start, count: groups[i].apps.length });
          start += groups[i].apps.length;
        }
        return spans;
      },
      // Every valid reported app, unfiltered by preferences: the settings
      // list must show hidden apps or there would be no way to unhide them.
      allApps: function () {
        var raw = this._lastData && this._lastData.apps;
        return (raw || []).filter(function (app) {
          if (!app || app.appId == null || !kit.text(app.appName)) return false;
          var aid = String(app.appId);
          return aid !== "vidaa-home" && aid !== "206";
        });
      },
      appVisible: function (app) {
        var only = this.prefs && this.prefs.onlyApps;
        var hidden = this.prefs && this.prefs.hiddenApps;
        if (Array.isArray(only) && only.length) return kit.inAppList(only, app);
        if (Array.isArray(hidden) && hidden.length) return !kit.inAppList(hidden, app);
        return true;
      },
      clamp: function () {
        var favLen = this.favoriteItems().length;
        this.fav = favLen > 0 ? Math.max(0, Math.min(this.fav, favLen - 1)) : 0;
        var srcLen = this.sources.length;
        this.inputSel = srcLen > 0 ? Math.max(0, Math.min(this.inputSel, srcLen - 1)) : 0;
        var overlayLen = this.overlayList().length;
        this.overlayIndex = overlayLen > 0 ? Math.max(0, Math.min(this.overlayIndex, overlayLen - 1)) : 0;
        if (this.settings) {
          if (this.settingsPage === "name") {
            this.nameIndex = Math.max(0, Math.min(this.nameIndex, kit.KB_CELLS.length - 1));
          } else {
            var rows = this.settingsRows();
            this.settingsIndex = rows.length ?
              Math.max(0, Math.min(this.settingsIndex, rows.length - 1)) : 0;
          }
        }
      }
    }
  };
  void C; // geometry lives with the render modules
}(self));
