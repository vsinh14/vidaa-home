/* Module 34 — remote keys for the page frame.
 *
 * One handler, one focus path, same contract as before: a handled key
 * stops propagation on the body "key-down" event, everything else falls
 * through to the vendor. The page frame replaces the three-row zone walk:
 *
 *   P100 (home)  RIGHT past the rail end / DOWN -> P110; LEFT/RIGHT walk
 *                the rail; BACK at the root is the vendor's, never ours.
 *   P110 (inputs) LEFT at the first tile / BACK -> P100; digits switch.
 *   digits       on P100 they select and launch rail slot 101..110; on
 *                P110 they select and switch the port.
 *   RED          edit mode on P100 (OK removes a block), stock TV
 *                settings everywhere else; GREEN = OK; YELLOW = Apps grid.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;

  kit.keyActions = {
    methods: {
      announce: function () {
        var sdk = kit.sdk;
        if (!sdk.tts || !sdk.tts.isEnable() || !sdk.router.isCurrentPathEqualTo("/Launcher")) return;
        var label;
        if (this.settings) {
          if (this.settingsPage === "name") {
            label = kit.KB_CELLS[this.nameIndex];
          } else {
            var row = this.settingsRows()[this.settingsIndex];
            label = row && (row.speak || row.label);
          }
        } else if (this.overlay) {
          var app = this.overlayList()[this.overlayIndex];
          label = app && kit.shortName(app.appName);
        } else if (this.page === "inputs") {
          var input = this.sources[this.inputSel];
          label = input && this.sourceName(input);
        } else {
          var fav = this.favoriteItems()[this.fav];
          label = fav && fav.label + (this.edit ? ", OK removes" : "");
        }
        if (label) sdk.tts.speak(label);
      },
      handleKey: function (code) {
        if (this.idle) {
          // The wake key must only wake. Consume it: change nothing, launch
          // nothing — a wake that also activates whatever it landed on is
          // worse than no idle screen.
          this.cancelIdle();
          return true;
        }
        // Presence: any key restarts the idle window, handled or not.
        this.armIdle();
        var keys = kit.keys;
        var color = kit.colorKeys[code];

        if (this.settings) {
          if (color === "red" && this.settingsPage !== "name") {
            this.openStockSettings();
            return true;
          }
          var handled = this.handleSettingsKey(code);
          // A key consumed by the settings layer still proves the user is
          // present, so the boot countdown must not fire mid-navigation.
          if (handled && this.autoSwitchAt) this.cancelAutoSwitch();
          return handled;
        }

        if (this.overlay) {
          if (code === keys.BACK || code === keys.RETURN) { this.closeOverlay(); return true; }
          if (code === keys.ENTER) { this.launchFocused(); return true; }
          if (color === "red") { this.openStockSettings(); return true; }
          var spans = this.overlaySpans();
          if (spans) {
            // Grouped navigation (issue #57): still one focus path over the
            // flattened groups. Left/Right step within the group and stop
            // at its ends; Up/Down step between groups, landing on the same
            // offset clamped to the target group's length.
            var group = 0, offset = 0;
            for (var s = 0; s < spans.length; s++) {
              if (this.overlayIndex < spans[s].start + spans[s].count) {
                group = s;
                offset = this.overlayIndex - spans[s].start;
                break;
              }
            }
            if (code === keys.LEFT) { if (offset > 0) this.overlayIndex--; }
            else if (code === keys.RIGHT) { if (offset < spans[group].count - 1) this.overlayIndex++; }
            else if (code === keys.UP) {
              if (group > 0) {
                var up = spans[group - 1];
                this.overlayIndex = up.start + Math.min(offset, up.count - 1);
              }
            }
            else if (code === keys.DOWN) {
              if (group < spans.length - 1) {
                var down = spans[group + 1];
                this.overlayIndex = down.start + Math.min(offset, down.count - 1);
              }
            }
            else return false;
            this.clamp();
            return true;
          }
          if (code === keys.LEFT) this.overlayIndex--;
          else if (code === keys.RIGHT) this.overlayIndex++;
          else if (code === keys.UP) this.overlayIndex -= kit.C.OCOLS;
          else if (code === keys.DOWN) this.overlayIndex += kit.C.OCOLS;
          else return false;
          this.clamp();
          return true;
        }

        // MENU opens the stock TV settings from the main pages, RED-style.
        if (kit.menuKey != null && code === kit.menuKey) {
          this.openStockSettings();
          return true;
        }
        if (color === "red") {
          if (this.page === "home") { this.toggleEdit(); return true; }
          return false; // no edit mode on P110: the vendor keeps its RED
        }
        if (color === "green") {
          if (this.edit) { this.edit = false; this.showToast("edit off"); return true; }
          this.activate();
          return true;
        }
        if (color === "yellow") { this.openOverlay(); return true; }

        var isNum = Object.prototype.hasOwnProperty.call(kit.numKeys, code);
        var isNav = (code === keys.ENTER || code === keys.DOWN || code === keys.UP ||
          code === keys.LEFT || code === keys.RIGHT || code === keys.BACK || code === keys.RETURN);
        if (this.autoSwitchAt && (isNum || isNav)) {
          this.cancelAutoSwitch();
          return true;
        }

        if (isNum) {
          var digit = kit.numKeys[code];
          if (this.page === "inputs") {
            var si = digit === 0 ? 9 : digit - 1;
            if (si < this.sources.length) {
              this.inputSel = si;
              this.clamp();
              this.activate();
              return true;
            }
            if (digit === 0 && this.sources.length) {
              this.inputSel = 0;
              this.clamp();
              return true;
            }
            return false;
          }
          // P100: the digit IS the tile number, 101-109 with 0 as 110.
          var fi = digit === 0 ? 9 : digit - 1;
          var items = this.favoriteItems();
          if (fi < items.length) {
            this.fav = fi;
            this.clamp();
            this.activate();
            return true;
          }
          this.showToast((101 + fi) + " is empty");
          return true; // the digit was for the rail; do not hand it to the vendor
        }

        if (this.page === "inputs") {
          if (code === keys.BACK || code === keys.RETURN) {
            this.page = "home";
            this.clamp();
            return true;
          }
          if (code === keys.ENTER) { this.activate(); return true; }
          if (code === keys.LEFT) {
            if (this.inputSel === 0) {
              this.page = "home";
              this.clamp();
              return true;
            }
            this.inputSel--;
          } else if (code === keys.RIGHT) this.inputSel++;
          else if (code === keys.UP) this.inputSel -= kit.C.INP_COLS;
          else if (code === keys.DOWN) this.inputSel += kit.C.INP_COLS;
          else return false;
          if (this.inputSel < 0) this.inputSel = 0;
          this.clamp();
          return true;
        }

        // P100, the landing page. BACK belongs to the vendor here.
        if (code === keys.BACK || code === keys.RETURN) return false;
        if (code === keys.ENTER) {
          if (this.edit) { this.removeFavorite(this.fav); return true; }
          this.activate();
          return true;
        }
        if (code === keys.RIGHT) {
          var len = this.favoriteItems().length;
          if (this.fav < len - 1) {
            this.fav++;
            this.clamp();
            return true;
          }
          // Past the rail end is the next page of the magazine.
          this.page = "inputs";
          this.inputSel = 0;
          this.clamp();
          return true;
        }
        if (code === keys.LEFT) {
          if (this.fav > 0) this.fav--;
          this.clamp();
          return true;
        }
        if (code === keys.DOWN || code === keys.UP) {
          this.page = "inputs";
          this.inputSel = this.smartIndex();
          this.clamp();
          return true;
        }
        return false;
      }
    }
  };
}(self));
