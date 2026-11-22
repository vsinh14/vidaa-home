/* Module 60 — overlay, settings, idle, chrome, and the frame.
 *
 * The apps grid (7x5 = 35 per page) with brand badges and mono names,
 * the Launcher settings panel (2px sharp-cornered white frame, mono
 * rows, pixel title), the idle clock layer, the toast, and the
 * auto-switch countdown — then renderAll() composes the root.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;
  var C = kit.C;

  kit.renderOverlay = function (P, vm) {
    var out = [];
    out.push(P.box(0, 0, 1920, 1080, { backgroundColor: "rgba(0,0,0,0.94)" }));
    out = out.concat(P.pxText("APPS", 6, kit.INK, C.MARGIN, C.TOP));
    var list = vm.overlayList();
    out.push(P.mono(C.RIGHT - 240, 60, 200, 18, list.length + " APPS", kit.DIM, "right"));

    var spans = vm.overlaySpans();
    var pages = Math.max(1, Math.ceil(list.length / C.OPAGE));
    var page = Math.floor(vm.overlayIndex / C.OPAGE);
    var start = page * C.OPAGE;
    var end = Math.min(start + C.OPAGE, list.length);
    for (var j = start; j < end; j++) {
      var slot = j - start;
      var col = slot % C.OCOLS, row = Math.floor(slot / C.OCOLS);
      var x = C.OX + col * (C.OCW + C.OGAPX);
      var y = C.OY + row * (C.OCH + C.OGAPY + 8);
      var app = list[j];
      var focused = j === vm.overlayIndex;
      if (focused) out.push(P.box(x - 4, y - 4, C.OCW + 8, C.OCH + 8,
        { border: "2px solid " + kit.INK }));
      out.push(P.box(x + (C.OCW - 36) / 2, y + 16, 36, 36,
        { backgroundColor: kit.tileFill(app.appName) }));
      out.push(P.mono(x, y + 64, C.OCW, 20,
        kit.shortName(app.appName).toUpperCase().slice(0, 14),
        focused ? kit.INK : kit.DIM, "center"));
      if (spans && j === spansHead(spans, j)) {
        // Group labels are secondary chrome: grey tier, not a colour.
        out = out.concat(P.pxText(String(spansLabel(spans, j)).toUpperCase().slice(0, 16),
          3, kit.DIM, x, Math.max(120, y - 20)));
      }
    }
    out.push(P.mono(C.MARGIN, 1006, 600, 16, "OK LAUNCH   BACK CLOSE   RED TV SETTINGS", kit.DIM));
    if (pages > 1) {
      out.push(P.mono(C.RIGHT - 240, 1006, 200, 16,
        "PAGE " + (page + 1) + "/" + pages, kit.DIM, "right"));
    }
    return out;
  };
  function spansHead(spans, j) {
    for (var s = 0; s < spans.length; s++) if (spans[s].start === j) return s;
    return -1;
  }
  function spansLabel(spans, j) {
    for (var s = 0; s < spans.length; s++) if (spans[s].start === j) return spans[s].name;
    return "";
  }

  var SETTINGS_TITLES = { root: "HOME SETTINGS", apps: "APPS", favorites: "FAVORITES",
    inputs: "INPUT NAMES", name: "RENAME" };
  var SETTINGS_HINTS = {
    root: "UP DOWN MOVE  OK OPEN",
    apps: "OK HIDE/SHOW  LEFT PIN",
    favorites: "OK REMOVE  UP DOWN MOVE",
    inputs: "OK RENAME",
    name: "BACK SAVES"
  };
  function valueColour(v) {
    if (v === "on" || v === "shown") return kit.GREEN;
    if (v === "off" || v === "hidden") return kit.FAINT;
    if (v === "custom") return kit.CYAN;
    if (v === "favorites full") return kit.RED;
    if (v === "OK removes" || v === "OK adds") return kit.AMBER;
    return kit.CYAN;
  }

  kit.renderSettings = function (P, vm) {
    var out = [];
    out.push(P.box(0, 0, 1920, 1080, { backgroundColor: "rgba(0,0,0,0.92)" }));
    out.push(P.box(C.SPX, C.SPY, C.SPW, C.SPH, {
      backgroundColor: "#000000",
      border: "2px solid " + kit.INK
    }));
    var page = vm.settingsPage;
    out = out.concat(P.pxText(SETTINGS_TITLES[page] || "HOME SETTINGS", 6,
      kit.INK, C.SPX + 36, C.SPY + 30));
    out.push(P.mono(C.SPX + C.SPW - 620, C.SPY + 44, 584, 16,
      SETTINGS_HINTS[page] || "", kit.DIM, "right"));

    if (page === "name") {
      // Draft line, then the 6x6 keyboard. Digits live in the keyboard,
      // not on the remote, because remote digits are the page numbers.
      out.push(P.box(C.SPX + 24, C.SPY + 140, C.SPW - 48, 84, {
        backgroundColor: "#000000",
        border: "2px solid " + kit.GRID
      }));
      out.push(P.box(C.SPX + 44, C.SPY + 140, C.SPW - 240, 84, {
        fontFamily: kit.MONO, fontSize: 34, lineHeight: 84, color: kit.INK,
        whiteSpace: "pre"
      }, [String(vm.nameDraft || ""), P.h("span", { style: { color: kit.AMBER } }, "\u258c")]));
      out.push(P.mono(C.SPX + C.SPW - 224, C.SPY + 168, 180, 16,
        String((vm.nameDraft || "").length) + "/" + kit.NAME_MAX, kit.DIM, "right"));
      var cellW = Math.floor((C.SPW - 48 - 5 * 10) / kit.KB_COLS);
      for (var k = 0; k < kit.KB_CELLS.length; k++) {
        var cell = kit.KB_CELLS[k];
        var col = k % kit.KB_COLS, row = Math.floor(k / kit.KB_COLS);
        var cx = C.SPX + 24 + col * (cellW + 10);
        var cy = C.SPY + 260 + row * 80;
        var focused = k === vm.nameIndex;
        out.push(P.box(cx, cy, cellW, 72, {
          backgroundColor: "#000000",
          border: "2px solid " + (focused ? kit.INK : "#1e1e1e")
        }, [P.mono(cx, cy, cellW, 24,
          cell === "BACKSPACE" ? "DEL" : cell === "SPACE" ? "SP" : cell,
          focused ? kit.INK : kit.DIM, "center")]));
      }
      return out;
    }

    var rows = vm.settingsRows();
    var listY = C.SPY + 140, rowH = 76;
    var visible = Math.floor((C.SPH - 160) / rowH);
    var first = Math.min(Math.max(0, vm.settingsIndex - visible + 1),
      Math.max(0, rows.length - visible));
    for (var i = first; i < Math.min(first + visible, rows.length); i++) {
      var row = rows[i];
      var y = listY + (i - first) * rowH;
      var focusedRow = i === vm.settingsIndex;
      out.push(P.box(C.SPX + 24, y, C.SPW - 48, 64, {
        backgroundColor: "#000000",
        border: "2px solid " + (focusedRow ? kit.INK : "#1e1e1e")
      }));
      out.push(P.mono(C.SPX + 44, y + (row.sub ? 8 : 17), 700, 24,
        row.label, kit.INK));
      if (row.sub) {
        out.push(P.mono(C.SPX + 44, y + 38, 700, 15, row.sub, kit.DIM));
      }
      if (row.value) {
        out.push(P.mono(C.SPX + C.SPW - 284, y + (row.sub ? 14 : 17), 260, 22,
          row.value, valueColour(row.value), "right"));
      }
    }
    return out;
  };

  kit.renderIdle = function (P, vm) {
    var out = [];
    out.push(P.box(0, 0, 1920, 1080, kit.merge(kit.wallpaperStyle(), {
      opacity: vm.idleFade,
      transition: "opacity 700ms ease"
    })));
    out.push(P.box(0, 0, 1920, 1080, {
      backgroundColor: "rgba(0,0,0,0.45)",
      opacity: vm.idleFade,
      transition: "opacity 700ms ease"
    }));
    var now = vm.now || new Date();
    var clock = kit.p2(now.getHours()) + ":" + kit.p2(now.getMinutes());
    var cx = (1920 - P.textWidth(clock, 22)) / 2;
    var date = (kit.DAYS[now.getDay()] + " " + kit.p2(now.getDate()) +
      " " + kit.MONTHS[now.getMonth()]).toUpperCase();
    var dx = (1920 - P.textWidth(date, 5)) / 2;
    // One wrapper carries the fade for the whole pixel type: the blocks
    // live inside it, so opacity animates once instead of per cell.
    out.push(P.box(0, 0, 1920, 1080, {
      opacity: vm.idleFade,
      transition: "opacity 700ms ease"
    }, P.pxText(clock, 22, kit.INK, cx, 400)
      .concat(P.pxText(date, 5, kit.DIM, dx, 620))));
    return out;
  };

  // The toast BAR is off: on this page it narrates what the screen
  // already shows ("edit mode..." while the rings are red, "PIN X"
  // under a ring walking to it) — a bar with no data. The whole
  // plumbing stays wired: model fields, showToast, the expiry tick,
  // and every call site. Flip the switch to bring the bar back.
  kit.TOAST_ON = false;
  kit.renderToast = function (P, vm) {
    if (!kit.TOAST_ON || !vm.toast) return [];
    var w = Math.min(1400, 64 + String(vm.toast).length * 13);
    var x = (1920 - w) / 2;
    // The toast floats just above the rail — the baseline parked it at
    // y 912 back when that strip was empty page, and the rail now owns
    // that lane; a toast there punched a black bar across the tiles.
    var y = C.RAIL_Y - 60;
    return [P.box(x, y, w, 52, {
      backgroundColor: "#000000",
      border: "2px solid " + kit.AMBER
    }, [P.mono(x + 16, y + 2, w - 32, 22, vm.toast, kit.AMBER, "center")])];
  };

  kit.renderHud = function (P, vm) {
    if (!vm.autoSwitchAt) return [];
    var secs = Math.max(0, Math.ceil((vm.autoSwitchAt - Date.now()) / 1000));
    var hud = ("AUTO " + String(vm.autoSwitchName || "").toUpperCase().slice(0, 12) +
      " " + secs + "S");
    // The countdown rides the superblock's top band — the sliver
    // between band edge and rail — so it never sits on the tiles.
    return P.pxText(hud, 4, kit.INK, (1920 - P.textWidth(hud, 4)) / 2, C.SUPER_Y);
  };

  kit.renderAll = function (vm, h) {
    var scale = (Number(vm.width) || 1920) / 1920;
    var P = kit.makePaint(h, scale);
    var kids = [];
    if (vm.idle) {
      kids = kit.renderIdle(P, vm);
    } else {
      kids = (vm.page === "inputs" ? kit.renderInputs(P, vm) : kit.renderHome(P, vm));
      if (vm.overlay) kids = kids.concat(kit.renderOverlay(P, vm));
      if (vm.settings) kids = kids.concat(kit.renderSettings(P, vm));
      kids = kids.concat(kit.renderHud(P, vm));
      kids = kids.concat(kit.renderToast(P, vm));
    }
    return h("div", {
      attrs: { id: "alvidaa-native" },
      style: {
        position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
        backgroundColor: "#000000", color: "#ffffff",
        fontFamily: kit.MONO, overflow: "hidden"
      }
    }, kids);
  };
}(self));
