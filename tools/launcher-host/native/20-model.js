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
        // Inputs split rail (owner design): the ports row is always the
        // bottom row (inputSel indexes it); the data row rides above and
        // only exists while inputsExpanded is set (inputDataSel indexes
        // it). inputRow is the focused lane: 1 = ports, 0 = data. A
        // fresh page always enters folded, focused on the ports row, so
        // entry focus is always the first port tile.
        inputDataSel: 0, inputRow: 1, inputsExpanded: false,
        // Marquee plumbing: the beat clock is derived at consume
        // time (kit.phaseMs keyed off the selection identity), so
        // nothing here stamps it and no nav path can forget to.
        // _phaseGen bumps only on lid travel, where the selection
        // itself may not have changed but the visible moment has.
        // mtick is the render's marquee dependency — the heartbeat
        // bumps it only while a scroll is actually on screen, so
        // the SoC never repaints for nobody.
        mtick: 0,
        // Zen mode: 5 s after the lid collapses the chrome fades to
        // just the clock, the date, and the wallpaper (owner,
        // 2026-11-22). zenAt arms at collapse; any key ends zen AND
        // lifts the lid. zenInk is sampled from the wallpaper once
        // at boot; the halo always backs the glyphs regardless.
        zen: false, zenAt: 0, zenInk: "#ffffff",
        // The rail's lid: DOWN covers the row, 30 s of silence covers it,
        // any key lifts it again. The foot and header never hide. The
        // clock arms at boot, not at zero — a fresh home never starts
        // the window already expired.
        railOpen: true, lastAct: Date.now(),
        overlay: false, overlayIndex: 0, overlayEdit: false,
        settings: false, settingsPage: "root", settingsIndex: 0,
        nameDraft: "", nameIndex: 0, nameSourceId: null,
        now: new Date(), width: self.innerWidth || 1920,
        toast: "", toastUntil: 0,
        idle: false, idleAt: 0, idleFade: 1,
        autoSwitchId: null, autoSwitchName: "", autoSwitchAt: 0,
        prefs: {
          hiddenApps: [], onlyApps: [], customNames: {}, lastUsed: null,
          autoSwitch: false, recentOrder: true, recent: {}, favorites: [],
          idleMinutes: 0, groups: [], dvd: true
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
          groups: kit.readPref("alvidaa_groups", []),
          dvd: kit.isTruthy(kit.readPref("alvidaa_dvd", true))
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
      // Pre-seed Inputs focus for the next visit (routeFocus). The
      // split rail enters folded, so the seed stays on the ports row:
      // the last-used port, else the first port with a device
      // reporting (deviceOf — the same truth that colors blocks),
      // else the first port.
      applySmartFocus: function () {
        var rows = this.inputRows();
        var ports = rows[1];
        var last = this.prefs && this.prefs.lastUsed;
        var lastStr = last != null ? String(last) : null;
        var i;
        for (i = 0; i < ports.length; i++) {
          if (lastStr && String(ports[i].sourceId) === lastStr) {
            this.inputRow = 1; this.inputSel = i; this.inputsExpanded = false;
            return;
          }
        }
        for (i = 0; i < ports.length; i++) {
          if (kit.deviceOf(ports[i]) !== "") {
            this.inputRow = 1; this.inputSel = i; this.inputsExpanded = false;
            return;
          }
        }
        this.inputRow = 1; this.inputSel = 0; this.inputsExpanded = false;
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
        // ONE view (owner redesign, 2026-11-22): the grid shows every
        // visible app; the pin state is read off the tiles themselves
        // (the green rail number), not off a hidden second view. RED
        // edits, it does not swap views.
        var groups = this.overlayGroups();
        if (!groups) return this.apps;
        // Anchor on this.apps so the flattened list stays in the same realm
        // as the list it re-orders (see sortRecent: realm-sensitive harness).
        var out = this.apps.slice(0, 0);
        for (var i = 0; i < groups.length; i++) out = out.concat(groups[i].apps);
        return out;
      },
      // The grid's section spans: owner-curated groups only. Pins are
      // not a section — they are a number, wherever the app sits.
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
      // Pin truth for any surface that needs to say "pinned": the
      // index in favorites (slot), or 0 when the app is not on the
      // rail. One map, read by the drawer number, the TTS, and the
      // settings sub-line — three former hand-rolled definitions,
      // two of which matched on id-OR-name and would disagree with
      // the rail itself (which matches on id) if a legacy name-entry
      // ever sat in the pref. Favourites are written as ids; ids are
      // the canonical form, and every surface now agrees.
      pinMap: function () {
        var favs = (this.prefs && this.prefs.favorites) || [];
        var map = {};
        if (Array.isArray(favs)) {
          for (var i = 0; i < favs.length; i++)
            map[String(favs[i])] = i + 1;
        }
        return map;
      },
      pinSlot: function (app) {
        if (!app || app.appId == null) return 0;
        return this.pinMap()[String(app.appId)] || 0;
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
      // The split rail's truth: [data row, ports row], classified by
      // the vendor's own label (kit.isPort), never by renames.
      inputRows: function () {
        var data = [], ports = [];
        for (var i = 0; i < this.sources.length; i++) {
          if (kit.isPort(this.sources[i])) ports.push(this.sources[i]);
          else data.push(this.sources[i]);
        }
        return [data, ports];
      },
      inputFocus: function () {
        var rows = this.inputRows();
        if (this.inputRow === 0) return rows[0][this.inputDataSel] || null;
        return rows[1][this.inputSel] || null;
      },
      // Entering Inputs is always the same opening: folded, ports lane,
      // first tile. No mode leaks in from the previous visit.
      enterInputs: function () {
        this.page = "inputs";
        this.inputsExpanded = false;
        this.inputRow = 1;
        this.inputSel = 0;
        this.inputDataSel = 0;
        this.clamp();
      },
      // One fold step: the data row vanishes; focus that sat in it
      // descends to the same column of the rail below (clamped).
      foldRows: function () {
        this.inputsExpanded = false;
        this.dropFocusToPorts();
      },
      dropFocusToPorts: function () {
        if (this.inputRow === 0) {
          this.inputRow = 1;
          this.inputSel = this.inputDataSel;
        }
        this.clamp();
      },
      // The lid covers BOTH rows: closing it folds the data row and
      // descends focus to the rail below. No half-open states exist.
      closeLid: function () {
        this.railOpen = false;
        this.foldRows();
        // The marquee beat belongs to the visible moment: the lid
        // travel bumps the phase generation, so the next render
        // after a reopen starts a fresh clock and reads word first,
        // never caught mid-scroll (owner, 2026-11-22).
        this._phaseGen = (this._phaseGen || 0) + 1;
        this.zenAt = Date.now();   // the 5 s chrome-fade arms now
      },
      openLid: function () {
        this.railOpen = true;
        this._phaseGen = (this._phaseGen || 0) + 1;
        this.zen = false;
        this.zenAt = 0;
      },
      zenTick: function (nowMs) {
        // Zen belongs to the resting TV only: never while a modal,
        // the screensaver, or an active edit session is up.
        if (this.zen || this.railOpen || this.idle || this.edit ||
            this.overlay || this.settings) return;
        if (this.zenAt && nowMs - this.zenAt >= kit.ZEN_MS) {
          this.zen = true;
          kit.zenDark = null;
          // DVD bounce: ten seconds after zen paints, the clock
          // block starts riding the screen (module 37). No-op when
          // the setting is off.
          if (kit.dvdStart) kit.dvdStart(this);
        }
      },
      clamp: function () {
        var favLen = this.favoriteItems().length;
        this.fav = favLen > 0 ? Math.max(0, Math.min(this.fav, favLen - 1)) : 0;
        var rows = this.inputRows();
        var dLen = rows[0].length, pLen = rows[1].length;
        if (dLen === 0) {
          // No data row exists to show or focus.
          this.inputsExpanded = false;
          if (this.inputRow === 0) this.inputRow = 1;
        }
        this.inputDataSel = dLen > 0 ? Math.max(0, Math.min(this.inputDataSel, dLen - 1)) : 0;
        this.inputSel = pLen > 0 ? Math.max(0, Math.min(this.inputSel, pLen - 1)) : 0;
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
      },
      scrollActive: function () {
        // Is a repaint worth it for the marquee? The ring block
        // shows the FULL name, so the guard asks the same question
        // the render does: does that full name run past the lane?
        // (The one-word rule covers every OTHER block — those
        // never animate.)
        if (this.idle || this.settings) return false;
        if (!this.railOpen && !this.overlay) return false;
        var lab = "", W = kit.LABEL_W;
        if (this.overlay) {
          // The drawer's focused tile walks the same beat, in a
          // tighter u3 lane: same question, tighter lane.
          var app = this.overlayList()[this.overlayIndex];
          if (!app) return false;
          lab = kit.text(app.appName).trim().toUpperCase();
          W = kit.OVERLAY_LABEL_W;
        } else if (this.page === "home") {
          var it = this.favoriteItems()[this.fav];
          lab = it ? kit.text(it.app && it.app.appName).trim().toUpperCase() : "";
        } else if (this.page === "inputs") {
          var input = this.inputFocus();
          if (!input) return false;
          lab = String(this.sourceName(input)).toUpperCase() ||
            (kit.text(input.name) || "").toUpperCase();
        } else {
          return false;
        }
        if (lab.length > W) return true; // a scroll to walk
        // Even a full name that fits needs one repaint: the beat
        // ends at SCROLL_HOLD and the block opens from its word
        // into the full name — without a beat firing near that
        // moment the word would sit there stuck.
        var word = kit.shortName(lab);
        return word !== lab && kit.phaseMs(this) <= kit.SCROLL_HOLD + kit.SCROLL_MS;
      }
    }
  };
  void C; // geometry lives with the render modules
}(self));
