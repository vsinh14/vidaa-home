/* Module 34 — remote keys for the page frame.
 *
 * One handler, one focus path, same contract as before: a handled key
 * stops propagation on the body "key-down" event, everything else falls
 * through to the vendor. The page frame replaces the three-row zone walk:
 *
 *   P100 (home)  open: RIGHT past the rail end -> P110; LEFT/RIGHT walk
 *                the rail. DOWN covers the rail; 30 s of silence covers
 *                it on either page.
 *   P110 (inputs) open: LEFT at the first tile / BACK -> P100; digits
 *                switch. DOWN is the lid here too.
 *   lid (either page, shared state) collapsed = navigation mode: RIGHT
 *                turns Home->Inputs, LEFT/BACK turn back, none lifts.
 *                EVERY other key lifts the lid instead — DOWN, OK,
 *                digits, MENU, even the vendor's UP — and the lift is
 *                that key's whole action. Foot legends excepted:
 *                YELLOW opens the grid through the lid, RED lifts AND
 *                enters edit together.
 *   digits       on P100 they select and launch rail slot 101..110; on
 *                P110 they select and switch the port.
 *   RED          edit mode on P100 (OK removes a block), stock TV
 *                settings everywhere else; YELLOW = Apps grid. Launching
 *                is the OK key alone — the remote has it, no colour-key
 *                alias needed.
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
          var input = this.inputFocus();
          label = input && this.sourceName(input);
        } else {
          var fav = this.favoriteItems()[this.fav];
          label = fav && fav.label + (this.edit ? ", OK removes" : "");
        }
        if (label) sdk.tts.speak(label);
      },
      railLidTick: function (nowMs) {
        // One heartbeat sample of the rail's lid. Edit mode keeps the
        // row open — closing mid-edit would strand the red ring on
        // hidden tiles.
        if (this.page === "home" || this.page === "inputs") {
          if (this.railOpen && !this.edit &&
              !this.settings && !this.overlay &&
              nowMs - this.lastAct >= kit.RAIL_LID_MS) {
            this.closeLid();
          }
        }
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
        this.lastAct = Date.now();
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

        var isNum = Object.prototype.hasOwnProperty.call(kit.numKeys, code);
        var isNav = (code === keys.ENTER || code === keys.DOWN || code === keys.UP ||
          code === keys.LEFT || code === keys.RIGHT || code === keys.BACK || code === keys.RETURN);
        if (this.autoSwitchAt && (isNum || isNav)) {
          this.cancelAutoSwitch();
          return true;
        }

        if (!this.railOpen) {
          // Collapsed = navigation mode. The lid is one state shared by
          // Home and Inputs; RIGHT turns to the next page, LEFT and
          // BACK turn back, and none of them lifts when the page is
          // really there — browse the magazine with the row hidden.
          // A nav key that CANNOT navigate means the user is lost:
          // the rail lifts to show where they are. Every other key
          // lifts too — DOWN, OK, digits, YELLOW, even the vendor's
          // UP — and the lift is that key's whole job; nothing
          // selects, launches or opens through a closed lid.
          if (code === keys.RIGHT) {
            if (this.page === "home") { this.enterInputs(); return true; }
            this.railOpen = true; return true;   // no next page: show them where they are
          }
          if (code === keys.LEFT) {
            if (this.page === "inputs") { this.page = "home"; this.clamp(); return true; }
            this.railOpen = true; return true;   // no previous page: same
          }
          if (code === keys.BACK || code === keys.RETURN) {
            if (this.page === "inputs") { this.page = "home"; this.clamp(); return true; }
            return false;  // at Home, BACK stays the vendor's exit, lid or not
          }
          // The foot legends act in both modes. YELLOW opens the apps
          // grid straight through the lid — the grid is the full page,
          // the lid stays down under it. RED lifts the rail AND enters
          // edit together: edit would otherwise steer tiles you
          // cannot see.
          if (color === "yellow") { this.openOverlay(); return true; }
          if (color === "red") {
            if (this.page === "home") {
              this.railOpen = true;
              this.toggleEdit();
              return true;
            }
            return false;  // Inputs: the vendor keeps its RED, lid or not
          }
          // Everything else lifts the rail, the vendor's UP included;
          // the lift is that key's whole job.
          this.railOpen = true;
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
        if (color === "yellow") { this.openOverlay(); return true; }

        if (isNum) {
          var digit = kit.numKeys[code];
          if (this.page === "inputs") {
            // Digits are dead on Inputs (owner, 2026-11-22): no port
            // teleport, no toast. The vendor keeps its channel keys.
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
          // Split-rail contract, one ladder for both rail shapes:
          //   BACK   an open rail folds to nav mode IN PLACE — data row
          //          vanishes, lid down, Inputs stays. The NEXT BACK is
          //          the page-nav Home, handled by the collapsed block.
          //   UP     raises: folded lifts the data row above the ports
          //          row (focus stays); expanded with focus on ports
          //          steps the ring up a lane; top row focused means
          //          top of the world — the vendor keeps UP.
          //   DOWN   always folds one row and lands focus on the rail
          //          below: from the data row it descends to the ports
          //          row, from the ports row it closes the lid.
          //   LEFT/RIGHT walk the rows continuously — data first,
          //          ports below — row starts and ends stepping into
          //          the neighbouring row, except the walk start,
          //          which faces Home like its ring faces LEFT, and
          //          the walk end, which simply ends.
          // ENTER launches the focused tile. Each row pages itself.
          var rows = this.inputRows();
          if (code === keys.BACK || code === keys.RETURN) {
            this.closeLid();
            return true;
          }
          if (code === keys.ENTER) { this.activate(); return true; }
          if (code === keys.UP) {
            if (!this.inputsExpanded) {
              if (rows[0].length) {
                this.inputsExpanded = true; // focus stays on the ports
                return true;
              }
              return false; // no data row to raise: the vendor's UP
            }
            if (this.inputRow === 1 && rows[0].length) {
              // Step up a lane: same column of the data row, clamped.
              this.inputRow = 0;
              this.inputDataSel = this.inputSel;
              this.clamp();
              return true;
            }
            return false; // top row focused: top of the world
          }
          if (code === keys.DOWN) {
            if (this.inputsExpanded) { this.foldRows(); return true; }
            this.closeLid();
            return true;
          }
          if (code === keys.LEFT) {
            if (this.inputRow === 0) {
              if (this.inputDataSel > 0) this.inputDataSel--;
              else {
                // The walk start faces Home, like its ring faces LEFT.
                this.page = "home";
                this.clamp();
                return true;
              }
            } else if (this.inputSel > 0) {
              this.inputSel--;
            } else if (this.inputsExpanded && rows[0].length) {
              // Continuous walk: step into the far end of the row above.
              this.inputRow = 0;
              this.inputDataSel = rows[0].length - 1;
            } else {
              // Folded: the ports start is the walk start; it faces Home.
              this.page = "home";
              this.clamp();
              return true;
            }
            this.clamp();
            return true;
          }
          if (code === keys.RIGHT) {
            if (this.inputRow === 0) {
              if (this.inputDataSel < rows[0].length - 1) this.inputDataSel++;
              else if (rows[1].length) {
                // Continuous walk: step into the ports row start.
                this.inputRow = 1;
                this.inputSel = 0;
              }
            } else if (this.inputSel < rows[1].length - 1) {
              this.inputSel++;
            }
            // Past the walk end the rail simply ends; Home is the way back.
            this.clamp();
            return true;
          }
          return false;
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
          this.enterInputs();
          return true;
        }
        if (code === keys.LEFT) {
          if (this.fav > 0) this.fav--;
          this.clamp();
          return true;
        }
        if (code === keys.DOWN) {
          // DOWN is the rail's lid: it covers the row. The next key lifts
          // it (the lift consumes that key, so DOWN does not flip-flop).
          this.closeLid();
          return true;
        }
        return false; // UP at the P100 root is the vendor's, like BACK
      }
    }
  };
}(self));
