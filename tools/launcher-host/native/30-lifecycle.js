/* Module 30 — lifecycle and services.
 *
 * Wiring the vendor platform into the component, the idle/auto-switch
 * timers, and the small "service" verbs the pages call (toast, run,
 * overlay open/close, stock settings). Bodies carried over verbatim from
 * the pre-split frontend; the art cross-fade and tint services were
 * dropped with the wallpaper-wash design (P100 now shows the wallpaper
 * as a band, not a per-input wash).
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;

  kit.lifecycle = {
    methods: {
      start: function () {
        this.readPrefs();
        if (this._running) return;
        this._running = true;
        var vm = this;
        var sdk = kit.sdk;
        this._platform = self.AlvidaaNativePlatform(sdk, function (data) {
          var firstPayload = !vm._payloadReceived;
          vm._payloadReceived = true;
          vm._lastData = data;
          vm.apps = vm.sortRecent(vm.filterApps(data.apps));
          vm.sources = data.sources.filter(function (input) {
            return input && input.sourceId != null;
          });
          // A source going live or dropping is presence too: it cancels the
          // idle screen and restarts the window. An unchanged payload does
          // not — the platform re-reports periodically, and re-arming on
          // every poll would mean the screen never idles at all.
          var liveKey = vm.sources.filter(kit.signalOf).map(function (input) {
            return String(input.sourceId);
          }).join(",");
          if (firstPayload || liveKey !== vm._liveIds) {
            vm._liveIds = liveKey;
            vm.cancelIdle();
          }
          if (data.errors && data.errors.length) {
            vm.showToast(data.errors.join("; "));
          }
          vm.clamp();
          if (firstPayload && vm.prefs && vm.prefs.autoSwitch) {
            var liveSources = vm.sources.filter(kit.signalOf);
            if (liveSources.length === 1) {
              vm.startAutoSwitch(liveSources[0]);
            }
          } else if (!firstPayload && vm.autoSwitchAt) {
            var live = vm.sources.filter(kit.signalOf);
            if (live.length !== 1 || live[0].sourceId !== vm.autoSwitchId) {
              vm.cancelAutoSwitch();
            }
          }
        });
        this._platform.start();
        this._clock = setInterval(function () {
          var nowMs = Date.now();
          var d = new Date(nowMs);
          // Vue re-render is not free on a TV SoC. The clock and date are
          // minute-grained, so the one-second heartbeat must not touch
          // reactive state unless what is on screen actually changed —
          // only the auto-switch countdown wants a per-second render.
          if (vm.autoSwitchAt || d.getMinutes() !== vm.now.getMinutes() ||
              d.getDate() !== vm.now.getDate()) {
            vm.now = d;
          }
          if (vm.idleAt && !vm.idle && nowMs >= vm.idleAt) {
            vm.enterIdle();
          }
          // The rail's lid: 30 s without a key closes the row on the
          // home page. Extracted to the model so the test can pull the
          // clock without waiting on this interval.
          vm.railLidTick(nowMs);
          if (vm.autoSwitchAt && nowMs >= vm.autoSwitchAt) {
            vm.triggerAutoSwitch();
          }
          if (vm.toast && nowMs >= vm.toastUntil) {
            vm.toast = "";
            vm.toastUntil = 0;
          }
        }, 1000);
        this._resize = function () { vm.width = self.innerWidth || 1920; };
        if (self.addEventListener) self.addEventListener("resize", this._resize);
        this.routeFocus();
        // Consume handled keys while bubbling, before document-level defaults.
        // The pages get first refusal; unrelated keys pass straight through
        // to the vendor — BACK at the P100 root is the vendor's, always.
        this._keyDown = function (event) {
          if (sdk.router.isCurrentPathEqualTo("/Launcher") && vm.handleKey(event.keyCode)) {
            event.stopPropagation();
            vm.announce();
          }
        };
        if (self.document && self.document.body) {
          self.document.body.addEventListener("key-down", this._keyDown);
        }
        self.AlvidaaNativeActive = this;
      },
      stop: function () {
        this._running = false;
        this._payloadReceived = false;
        if (this._platform) this._platform.stop();
        clearInterval(this._clock);
        if (this._autoSwitchTimer) {
          clearTimeout(this._autoSwitchTimer);
          this._autoSwitchTimer = null;
        }
        this.autoSwitchAt = 0;
        this.autoSwitchId = null;
        this.autoSwitchName = "";
        this.idle = false;
        this.idleFade = 1;
        this.idleAt = 0;
        this._liveIds = "";
        this.edit = false;
        if (this._idleFadeTimer) {
          clearTimeout(this._idleFadeTimer);
          this._idleFadeTimer = null;
        }
        if (self.document && self.document.body) {
          self.document.body.removeEventListener("key-down", this._keyDown);
        }
        if (self.removeEventListener) self.removeEventListener("resize", this._resize);
        if (self.AlvidaaNativeActive === this) self.AlvidaaNativeActive = null;
      },
      routeFocus: function () {
        // Every arrival at Home lands on P100 with the rail focused; P110
        // keeps its smart index for the next visit. Edit mode never
        // survives a route change.
        this.page = "home";
        this.edit = false;
        this.overlay = false;
        this.closeSettings();
        this.fav = 0;
        this.applySmartFocus();
        this.clamp();
      },
      run: function (action) {
        var vm = this;
        try {
          var result = action();
          if (result && typeof result.then === "function") {
            result.catch(function (error) { vm.showToast("Action failed: " + error.message); });
          }
        } catch (error) { this.showToast("Action failed: " + error.message); }
      },
      showToast: function (text, ms) {
        if (!text) return;
        this.toast = String(text);
        this.toastUntil = Date.now() + (typeof ms === "number" ? ms : 2500);
      },
      openStockSettings: function () {
        // RED / MENU from any main page: the real TV settings, same call
        // the old door tile used.
        this.showToast("Opening TV settings\u2026");
        var vm = this;
        this.run(function () { return vm._platform.openSettings(); });
      },
      toggleEdit: function () {
        if (!this.favoriteItems().length) {
          this.showToast("Nothing pinned yet");
          return;
        }
        this.edit = !this.edit;
        this.showToast(this.edit ? "edit mode: OK removes a block" : "edit off");
      },
      activate: function () {
        var vm = this;
        // A launch or switch cancels the idle screen on every path.
        this.cancelIdle();
        if (this.page === "inputs") {
          var input = this.inputFocus();
          if (!input) return;
          if (this.prefs) this.prefs.lastUsed = input.sourceId;
          kit.writePref("alvidaa_last_used", input.sourceId);
          this.showToast("Switching to " + this.sourceName(input) + "\u2026");
          this.run(function () { return vm._platform.changeSource(input.sourceId); });
          return;
        }
        var item = this.favoriteItems()[this.fav];
        if (!item) {
          // Empty rail: OK opens the app grid to pin something from.
          this.openOverlay();
          return;
        }
        this.showToast("Opening " + (item.label || "app") + "\u2026");
        this.recordLaunch(item.appId);
        this.run(function () { return vm._platform.launchApp(item.appId); });
      },
      launchFocused: function () {
        var vm = this, app = this.overlayList()[this.overlayIndex];
        if (!app) return;
        this.cancelIdle();
        this.showToast("Opening " + (kit.shortName(app.appName) || "app") + "\u2026");
        this.recordLaunch(app.appId);
        this.run(function () { return vm._platform.launchApp(app.appId); });
        this.closeOverlay();
      },
      startAutoSwitch: function (input) {
        if (!input || input.sourceId == null) return;
        this.autoSwitchId = input.sourceId;
        this.autoSwitchName = this.sourceName(input);
        this.autoSwitchAt = Date.now() + 3500;
        var vm = this;
        if (typeof setTimeout === "function") {
          this._autoSwitchTimer = setTimeout(function () {
            vm.triggerAutoSwitch();
          }, 3500);
        }
      },
      triggerAutoSwitch: function () {
        if (!this.autoSwitchAt || this.autoSwitchId == null) return;
        var sid = this.autoSwitchId;
        this.autoSwitchAt = 0;
        this.autoSwitchId = null;
        this.autoSwitchName = "";
        if (this._autoSwitchTimer) {
          clearTimeout(this._autoSwitchTimer);
          this._autoSwitchTimer = null;
        }
        var vm = this;
        this.run(function () { return vm._platform.changeSource(sid); });
      },
      cancelAutoSwitch: function () {
        if (this.autoSwitchAt) {
          this.autoSwitchAt = 0;
          this.autoSwitchId = null;
          this.autoSwitchName = "";
          if (this._autoSwitchTimer) {
            clearTimeout(this._autoSwitchTimer);
            this._autoSwitchTimer = null;
          }
          this.showToast("auto-switch cancelled");
        }
      },
      // --- idle screen (issue #58) -----------------------------------------
      //
      // One deadline (idleAt), armed by anything that proves presence — a
      // key, a source change, a launch, arriving at the Home — and checked
      // by the clock interval that already runs every second, so there is
      // no second interval. While the idle layer is up, handleKey consumes
      // every key: the wake key must only wake, never also activate what it
      // lands on.
      armIdle: function () {
        var minutes = this.prefs ? Number(this.prefs.idleMinutes) || 0 : 0;
        this.idleAt = minutes > 0 ? Date.now() + minutes * 60000 : 0;
        return this.idleAt;
      },
      enterIdle: function () {
        if (this.idle || !this.idleAt) return;
        this.idle = true;
        this.idleAt = 0;
        this.idleFade = 0;
        var vm = this;
        if (typeof setTimeout === "function") {
          // Paint at opacity 0, then flip on a tick so the transition runs.
          this._idleFadeTimer = setTimeout(function () {
            vm.idleFade = 1;
            vm._idleFadeTimer = null;
          }, 16);
        } else {
          this.idleFade = 1;
        }
      },
      cancelIdle: function () {
        // The wake path and the source-change path both come through here:
        // drop the layer and re-arm the window with the current setting.
        if (this._idleFadeTimer) {
          clearTimeout(this._idleFadeTimer);
          this._idleFadeTimer = null;
        }
        this.idle = false;
        this.idleFade = 1;
        return this.armIdle();
      },
      cycleIdle: function (dir) {
        var at = kit.IDLE_STEPS.indexOf(Number(this.prefs.idleMinutes) || 0);
        if (at < 0) at = 0;
        kit.writePref("alvidaa_idle_minutes",
          kit.IDLE_STEPS[(at + (dir < 0 ? kit.IDLE_STEPS.length - 1 : 1)) % kit.IDLE_STEPS.length]);
        this.readPrefs();
        // Re-arm with the new value; stepping to off wakes the screen.
        return this.cancelIdle();
      },
      // Every launchApp goes through here first: stamp alvidaa_recent so the
      // overlay can order by it, pruning to the newest RECENT_MAX entries.
      recordLaunch: function (appId) {
        if (appId == null || !this.prefs.recentOrder) return;
        var recent = kit.readPref("alvidaa_recent", {});
        if (!recent || typeof recent !== "object" || Array.isArray(recent)) recent = {};
        recent[String(appId)] = Date.now();
        var ids = Object.keys(recent);
        if (ids.length > kit.RECENT_MAX) {
          ids.sort(function (a, b) { return recent[a] - recent[b]; });
          while (ids.length > kit.RECENT_MAX) delete recent[ids.shift()];
        }
        kit.writePref("alvidaa_recent", recent);
        this.prefs.recent = recent;
        // Re-rank the list in place rather than going through readPrefs():
        // a launch record changes no visibility, and re-filtering from the
        // last payload here would reset the overlay list mid-launch.
        this.apps = this.sortRecent(this.apps);
      },
      openOverlay: function () {
        if (!this.apps.length) { this.showToast("No apps reported"); return; }
        this.overlay = true;
        this.overlayIndex = 0;
      },
      closeOverlay: function () { this.overlay = false; },
      openLauncherSettings: function () {
        this.settings = true;
        this.settingsPage = "root";
        this.settingsIndex = 0;
        this.nameDraft = "";
        this.nameIndex = 0;
        this.nameSourceId = null;
      },
      closeSettings: function () {
        this.settings = false;
        this.settingsPage = "root";
        this.settingsIndex = 0;
        this.nameDraft = "";
        this.nameIndex = 0;
        this.nameSourceId = null;
      }
    }
  };
}(self));
