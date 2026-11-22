/* Module 32 — the settings surface.
 *
 * The Launcher's own settings page (not the stock TV menu): rows per
 * page, the actions they trigger, and the name editor's on-screen
 * keyboard. Bodies carried over verbatim from the pre-split frontend;
 * FAV_MAX moved 6 -> 18, so the favorites picker says "18" and the rail
 * pages in blocks of six.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;

  kit.settings = {
    methods: {
      // The focused page's rows, rebuilt on every read so the labels follow
      // the preferences. Rows carry `speak` when the spoken form should be
      // richer than the label.
      settingsRows: function () {
        var vm = this, rows = [];
        if (this.settingsPage === "name") return rows;
        if (this.settingsPage === "favorites") {
          // The picker: pinned apps first, in pin order (OK removes, a
          // Move up row reorders), then every unpinned app (OK adds).
          var favs = (this.prefs && this.prefs.favorites) || [];
          var pinned = {};
          favs.forEach(function (id) { pinned[String(id)] = true; });
          var favApps = [];
          favs.forEach(function (id) {
            for (var j = 0; j < vm.apps.length; j++) {
              if (String(vm.apps[j].appId) === String(id)) { favApps.push(vm.apps[j]); break; }
            }
          });
          favApps.forEach(function (app, i) {
            rows.push({
              kind: "fav-remove", favIndex: i, app: app,
              label: (i + 1) + ". " + kit.shortName(app.appName),
              value: "OK removes",
              speak: "Favorite " + (i + 1) + ", " + kit.shortName(app.appName) + ", OK removes"
            });
            if (i > 0) {
              rows.push({
                kind: "fav-up", favIndex: i,
                label: "Move up", sub: "above " + kit.shortName(app.appName),
                speak: "Move " + kit.shortName(app.appName) + " up"
              });
            }
          });
          this.allApps().forEach(function (app) {
            if (!vm.appVisible(app) || pinned[String(app.appId)]) return;
            var full = favs.length >= kit.FAV_MAX;
            rows.push({
              kind: "fav-add", app: app,
              label: "Add " + kit.shortName(app.appName),
              value: full ? "favorites full" : "OK adds",
              speak: kit.shortName(app.appName) + (full ? ", favorites full" : ", OK adds")
            });
          });
          return rows;
        }
        if (this.settingsPage === "apps") {
          var favs2 = (this.prefs && this.prefs.favorites) || [];
          this.allApps().forEach(function (app) {
            var visible = vm.appVisible(app);
            var isPinned = kit.inAppList(favs2, app);
            rows.push({
              kind: "app", app: app,
              label: kit.shortName(app.appName),
              value: visible ? "shown" : "hidden",
              sub: isPinned ? "pinned" : "",
              speak: kit.shortName(app.appName) + ", " + (visible ? "shown" : "hidden") +
                (isPinned ? ", pinned" : "")
            });
          });
          return rows;
        }
        if (this.settingsPage === "inputs") {
          this.sources.forEach(function (input) {
            if (!input || input.sourceId == null) return;
            var custom = vm.prefs && vm.prefs.customNames &&
              kit.text(vm.prefs.customNames[String(input.sourceId)]);
            rows.push({
              kind: "input", input: input,
              label: vm.sourceName(input),
              value: custom ? "custom" : "",
              sub: String(input.sourceId),
              speak: vm.sourceName(input) + (custom ? ", custom name" : "")
            });
            if (custom) {
              rows.push({
                kind: "reset-name", input: input,
                label: "Reset name", sub: "clears the custom name",
                speak: "Reset name for " + vm.sourceName(input)
              });
            }
          });
          return rows;
        }
        var total = this.allApps().length, customCount = 0;
        this.sources.forEach(function (input) {
          if (vm.prefs && vm.prefs.customNames &&
              kit.text(vm.prefs.customNames[String(input.sourceId)])) customCount++;
        });
        rows.push({
          kind: "autoswitch", label: "Auto-switch on boot",
          value: this.prefs.autoSwitch ? "on" : "off",
          speak: "Auto-switch on boot, " + (this.prefs.autoSwitch ? "on" : "off")
        });
        rows.push({
          kind: "open-apps", label: "Apps",
          sub: this.apps.length + " shown, " + (total - this.apps.length) + " hidden"
        });
        var favCount = ((this.prefs && this.prefs.favorites) || []).length;
        rows.push({
          kind: "open-favorites", label: "Favorites",
          sub: favCount + " of " + kit.FAV_MAX + " pinned"
        });
        rows.push({
          kind: "open-inputs", label: "Input names",
          sub: this.sources.length + " inputs" +
            (customCount ? " \u00b7 " + customCount + " renamed" : "")
        });
        var only = this.prefs && this.prefs.onlyApps;
        if (Array.isArray(only) && only.length) {
          rows.push({
            kind: "only-list", label: "Only-list active",
            sub: "overrides hidden apps \u00b7 OK clears it",
            speak: "Only-list active, overrides hidden apps"
          });
        }
        rows.push({
          kind: "idle", label: "Idle screen",
          value: this.prefs.idleMinutes > 0 ? this.prefs.idleMinutes + " min" : "off",
          speak: "Idle screen, " +
            (this.prefs.idleMinutes > 0 ? this.prefs.idleMinutes + " minutes" : "off")
        });
        rows.push({
          kind: "recent", label: "Recently-used order",
          sub: "sorts the apps overlay by launch time",
          value: this.prefs.recentOrder ? "on" : "off",
          speak: "Recently used order, " + (this.prefs.recentOrder ? "on" : "off")
        });
        return rows;
      },
      toggleAutoSwitch: function () {
        kit.writePref("alvidaa_auto_switch", !this.prefs.autoSwitch);
        this.readPrefs();
      },
      toggleRecentOrder: function () {
        kit.writePref("alvidaa_recent_order", !this.prefs.recentOrder);
        this.readPrefs();
      },
      toggleAppVisible: function (app) {
        if (!app || app.appId == null) return;
        var only = this.prefs && this.prefs.onlyApps;
        if (Array.isArray(only) && only.length && !kit.inAppList(only, app)) {
          // Writing the hidden list would be a silent no-op while the
          // only-list governs visibility; say so instead of pretending.
          this.showToast("the only-list overrides visibility");
          return;
        }
        var hidden = Array.isArray(this.prefs.hiddenApps) ? this.prefs.hiddenApps.slice() : [];
        var id = String(app.appId).toLowerCase();
        var name = (app.appName || "").trim().toLowerCase();
        var keep = [];
        for (var i = 0; i < hidden.length; i++) {
          var entry = String(hidden[i]).trim().toLowerCase();
          if (entry === id || (name && entry === name)) continue;
          keep.push(hidden[i]);
        }
        if (this.appVisible(app)) keep.push(String(app.appId));
        kit.writePref("alvidaa_hidden_apps", keep);
        this.readPrefs();
      },
      togglePin: function (app) {
        if (!app || app.appId == null) return;
        var favs = Array.isArray(this.prefs.favorites) ? this.prefs.favorites.slice() : [];
        var id = String(app.appId);
        var at = -1;
        for (var i = 0; i < favs.length; i++) {
          if (String(favs[i]) === id) { at = i; break; }
        }
        if (at >= 0) favs.splice(at, 1);
        else {
          // Refuse loudly rather than silently dropping the pin.
          if (favs.length >= kit.FAV_MAX) { this.showToast("favorites are full"); return; }
          favs.push(id);
        }
        kit.writePref("alvidaa_favorites", favs);
        this.readPrefs();
      },
      // Picker actions: remove one pin, move one pin up, add a pin. Each
      // writes through the same pref key and keeps the rail bounded by
      // FAV_MAX.
      removeFavorite: function (index) {
        var favs = Array.isArray(this.prefs.favorites) ? this.prefs.favorites.slice() : [];
        if (index < 0 || index >= favs.length) return;
        favs.splice(index, 1);
        kit.writePref("alvidaa_favorites", favs);
        this.readPrefs();
        this.clamp();
      },
      moveFavoriteUp: function (index) {
        var favs = Array.isArray(this.prefs.favorites) ? this.prefs.favorites.slice() : [];
        if (index <= 0 || index >= favs.length) return;
        var moved = favs.splice(index, 1)[0];
        favs.splice(index - 1, 0, moved);
        kit.writePref("alvidaa_favorites", favs);
        this.readPrefs();
        this.clamp();
      },
      addFavorite: function (app) {
        if (!app || app.appId == null) return;
        var favs = Array.isArray(this.prefs.favorites) ? this.prefs.favorites.slice() : [];
        if (favs.length >= kit.FAV_MAX) { this.showToast("favorites are full"); return; }
        var id = String(app.appId);
        for (var i = 0; i < favs.length; i++) {
          if (String(favs[i]) === id) return;
        }
        favs.push(id);
        kit.writePref("alvidaa_favorites", favs);
        this.readPrefs();
        this.clamp();
      },
      clearOnlyList: function () {
        kit.writePref("alvidaa_only_apps", []);
        this.readPrefs();
      },
      // --- input name editor -------------------------------------------------
      openNameEditor: function (input) {
        if (!input || input.sourceId == null) return;
        this.settingsPage = "name";
        this.nameSourceId = input.sourceId;
        var custom = this.prefs && this.prefs.customNames;
        var seed = custom ? kit.text(custom[String(input.sourceId)]) : "";
        this.nameDraft = seed || "";
        this.nameIndex = 0;
      },
      closeNameEditor: function () {
        this.settingsPage = "inputs";
        this.nameDraft = "";
        this.nameIndex = 0;
        this.nameSourceId = null;
        this.clamp();
      },
      commitNameDraft: function () {
        var sid = this.nameSourceId;
        if (sid == null) { this.closeNameEditor(); return; }
        var trimmed = String(this.nameDraft || "").trim();
        var names = kit.readPref("alvidaa_custom_names", {});
        if (!names || typeof names !== "object" || Array.isArray(names)) names = {};
        // A blank draft means "back to the vendor name": delete the key,
        // never store an empty string.
        if (trimmed) names[String(sid)] = trimmed;
        else delete names[String(sid)];
        kit.writePref("alvidaa_custom_names", names);
        this.settingsPage = "inputs";
        this.nameDraft = "";
        this.nameIndex = 0;
        this.nameSourceId = null;
        this.readPrefs();
      },
      resetName: function (input) {
        if (!input || input.sourceId == null) return;
        var names = kit.readPref("alvidaa_custom_names", {});
        if (names && typeof names === "object" && !Array.isArray(names)) {
          delete names[String(input.sourceId)];
          kit.writePref("alvidaa_custom_names", names);
        }
        this.readPrefs();
      },
      kbPress: function () {
        var cell = kit.KB_CELLS[this.nameIndex];
        if (!cell) return;
        if (cell === "DONE") { this.commitNameDraft(); return; }
        if (cell === "BACKSPACE") { this.nameDraft = this.nameDraft.slice(0, -1); return; }
        if (cell === "CLEAR") { this.nameDraft = ""; return; }
        if (this.nameDraft.length >= kit.NAME_MAX) {
          this.showToast(kit.NAME_MAX + " characters max");
          return;
        }
        this.nameDraft += cell === "SPACE" ? " " : cell;
      },
      activateSettingsRow: function () {
        var row = this.settingsRows()[this.settingsIndex];
        if (!row) return;
        if (row.kind === "autoswitch") this.toggleAutoSwitch();
        else if (row.kind === "recent") this.toggleRecentOrder();
        else if (row.kind === "idle") this.cycleIdle(1);
        else if (row.kind === "open-apps") { this.settingsPage = "apps"; this.settingsIndex = 0; this.clamp(); }
        else if (row.kind === "open-favorites") { this.settingsPage = "favorites"; this.settingsIndex = 0; this.clamp(); }
        else if (row.kind === "open-inputs") { this.settingsPage = "inputs"; this.settingsIndex = 0; this.clamp(); }
        else if (row.kind === "only-list") this.clearOnlyList();
        else if (row.kind === "app") this.toggleAppVisible(row.app);
        else if (row.kind === "input") this.openNameEditor(row.input);
        else if (row.kind === "reset-name") this.resetName(row.input);
      },
      nudgeSettingsRow: function (dir) {
        var row = this.settingsRows()[this.settingsIndex];
        if (!row) return;
        // Left/Right change a value: the toggles, the pin, and the idle
        // timeout, which steps off / 1 / 5 / 15 in the direction pressed.
        if (row.kind === "autoswitch") this.toggleAutoSwitch();
        else if (row.kind === "recent") this.toggleRecentOrder();
        else if (row.kind === "app") this.togglePin(row.app);
        else if (row.kind === "fav-remove") this.removeFavorite(row.favIndex);
        else if (row.kind === "fav-up") this.moveFavoriteUp(row.favIndex);
        else if (row.kind === "fav-add") this.addFavorite(row.app);
        else if (row.kind === "idle") this.cycleIdle(dir);
      },
      handleSettingsKey: function (code) {
        var keys = kit.keys;
        if (this.settingsPage === "name") {
          if (code === keys.BACK || code === keys.RETURN) { this.closeNameEditor(); return true; }
          if (code === keys.ENTER) { this.kbPress(); return true; }
          if (code === keys.LEFT) { this.nameIndex--; this.clamp(); return true; }
          if (code === keys.RIGHT) { this.nameIndex++; this.clamp(); return true; }
          if (code === keys.UP) { this.nameIndex -= kit.KB_COLS; this.clamp(); return true; }
          if (code === keys.DOWN) { this.nameIndex += kit.KB_COLS; this.clamp(); return true; }
          return false;
        }
        if (code === keys.BACK || code === keys.RETURN) {
          // Sub-pages hand Back to their parent; the root page closes the
          // layer. Back at the pages still belongs to the vendor.
          if (this.settingsPage !== "root") {
            this.settingsPage = "root";
            this.clamp();
            return true;
          }
          this.closeSettings();
          return true;
        }
        if (code === keys.ENTER) { this.activateSettingsRow(); return true; }
        if (code === keys.UP) { this.settingsIndex--; this.clamp(); return true; }
        if (code === keys.DOWN) { this.settingsIndex++; this.clamp(); return true; }
        if (code === keys.LEFT) { this.nudgeSettingsRow(-1); return true; }
        if (code === keys.RIGHT) { this.nudgeSettingsRow(1); return true; }
        // Unhandled keys (digits included) pass through, same contract as
        // the apps overlay.
        return false;
      }
    }
  };
}(self));
