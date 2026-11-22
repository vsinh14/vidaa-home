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

    // Pin truth = the rail's own number, in the rail's own top-right
    // slot. The grid does not hide the pin state behind a second
    // view: you see who is on the rail, and in what order, from
    // inside the same grid (owner redesign, 2026-11-22).
    var pinOf = {};
    var favs = (vm.prefs && vm.prefs.favorites) || [];
    for (var f = 0; f < favs.length; f++) pinOf[String(favs[f])] = f + 1;

    var list = vm.overlayList();
    var spans = vm.overlaySpans();
    var pages = Math.max(1, Math.ceil(list.length / C.OPAGE));
    var page = Math.floor(vm.overlayIndex / C.OPAGE);
    var start = page * C.OPAGE;
    var end = Math.min(start + C.OPAGE, list.length);
    var LW = 8;                       // u3 label lane in a 172 tile
    for (var j = start; j < end; j++) {
      var slot = j - start;
      var col = slot % C.OCOLS, row = Math.floor(slot / C.OCOLS);
      var x = C.OX + col * (C.OCW + C.OGAPX);
      var y = C.OY + row * (C.OCH + C.OGAPY);
      var app = list[j];
      var focused = j === vm.overlayIndex;
      var full = kit.text(app.appName).trim().toUpperCase();
      var fill = kit.tileFill(app.appName);
      var ink = kit.inkFor(fill);

      // Brand block, painted like a rail tile. Where the vendor
      // carries an icon, it sits in the identity slot the rail's
      // letter uses — one identity per block; without an icon the
      // letter is the identity, exactly as on the rail.
      var st = { backgroundColor: fill };
      var icon = kit.text(app.appIcon).trim();
      var hasIcon = /^https?:\/\//.test(icon);
      if (hasIcon) {
        st.backgroundImage = "url(\"" + icon.replace(/["\\]/g, "") + "\")";
        st.backgroundSize = "56px 56px";
        st.backgroundRepeat = "no-repeat";
        st.backgroundPosition = "10px 10px";
      }
      out.push(P.box(x, y, C.OCW, C.OCH, st));
      if (!hasIcon) {
        out = out.concat(P.pxText(full ? full.slice(0, 1) : "?", 6, ink,
          x + 12, y + 12));
      }
      var num = pinOf[String(app.appId)];
      if (num) {
        // The number is cut OUT of the block, teletext-stencil
        // style (owner, 2026-11-22): a hard mini-block in the
        // tile's own letter ink, and the digit punched through in
        // the block's own brand colour. No launcher pigment sits
        // on a brand block — the rail's rule, now kept here too —
        // and the digit can never fail contrast, because ink and
        // fill are the pair the palette already chose for each
        // other.
        var ns = String(num);
        var nw = P.textWidth(ns, 4);
        var bw = nw + 12;
        var bx = x + C.OCW - 10 - bw, by = y + 10;
        out.push(P.box(bx, by, bw, 40, { backgroundColor: ink }));
        out = out.concat(P.pxText(ns, 4, fill, bx + 6, by + 6));
      }

      // The label lane, in the rail's language: every block shows
      // ONE WORD, and the block the ring rests on reads the FULL
      // name after the same beat — hold, then integer-cell walk
      // through the padded name. Same clock (the drawer is its own
      // lane in kit.selKey), same hold, same step.
      var L = kit.tileLabel(full, kit.shortName(full));
      var ly = y + C.OCH - 27;
      var lab = L.full || L.word;
      if (focused) {
        var el = kit.phaseMs(vm);
        if (el <= kit.SCROLL_HOLD) {
          out = out.concat(P.pxText(L.word.slice(0, LW), 3, ink, x + 10, ly));
        } else if (lab.length > LW) {
          var cyc = lab + " ", per = cyc.length;
          var s2 = Math.floor((el - kit.SCROLL_HOLD) / kit.SCROLL_MS);
          s2 = ((s2 % per) + per) % per;
          var win = "";
          for (var wc = 0; wc < LW; wc++) win += cyc.charAt((s2 + wc) % per);
          out = out.concat(P.pxText(win, 3, ink, x + 10, ly));
        } else {
          out = out.concat(P.pxText(lab, 3, ink, x + 10, ly));
        }
        out.push(P.ring(x, y, C.OCW, C.OCH, 4, vm.overlayEdit ? kit.RED : kit.INK));
      } else {
        out = out.concat(P.pxText(L.word.slice(0, LW), 3, ink, x + 10, ly));
      }

      if (spans && j === spansHead(spans, j)) {
        // Group labels are secondary chrome: grey tier, sitting in
        // the vertical gap, never on a tile.
        out = out.concat(P.pxText(String(spansLabel(spans, j)).toUpperCase().slice(0, 16),
          3, kit.DIM, x, y - 24));
      }
    }

    // The foot, in the page language: only the door the grid can
    // actually open — YELLOW is already named by the page it closes
    // back to, so it earns no legend here (owner, 2026-11-22). The
    // right-hand cue line states the mode; outside edit the cue slot
    // carries the teletext page number instead — cyan, where P100
    // wore its index.
    var fy = C.FOOT_Y, fx = C.MARGIN;
    out.push(P.chip(fx, fy + 3, kit.RED));
    out = out.concat(P.pxText("EDIT", 4, kit.INK, fx + 32, fy));
    if (vm.overlayEdit) {
      var focusApp = list[vm.overlayIndex];
      var fpin = focusApp && pinOf[String(focusApp.appId)];
      var cue;
      if (!fpin && favs.length >= kit.FAV_MAX)
        cue = "UP DOWN MOVE   PINS FULL   RED EXIT";
      else
        cue = "UP DOWN MOVE   OK " + (fpin ? "UNPIN" : "PIN") + "   RED EXIT";
      out = out.concat(P.pxText(cue, 4, kit.RED,
        C.RIGHT - P.textWidth(cue, 4), C.FOOT_Y));
    } else if (pages > 1) {
      var pg = (page + 1) + "/" + pages;
      out = out.concat(P.pxText(pg, 4, kit.CYAN,
        C.RIGHT - P.textWidth(pg, 4), C.FOOT_Y));
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

  var SETTINGS_TITLES = { root: "HOME SETTINGS", apps: "APPS",
    inputs: "INPUT NAMES", name: "RENAME" };
  var SETTINGS_HINTS = {
    root: "UP DOWN MOVE  OK OPEN",
    apps: "OK HIDE/SHOW",
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
    var page = vm.settingsPage;
    // The panel WRAPS ITS CONTENT (owner, 2026-11-22): height is
    // header + the rows that exist + padding, capped at the old
    // full-height panel, and the box re-centres vertically. A short
    // list is a short box; only a list deeper than the cap scrolls.
    var rowH = 76;
    var maxVisible = Math.floor((C.SPH - 160) / rowH);
    var rows = page === "name" ? [] : vm.settingsRows();
    var visible = Math.min(rows.length, maxVisible);
    var ph;
    if (page === "name") {
      var kbRows = Math.ceil(kit.KB_CELLS.length / kit.KB_COLS);
      ph = 260 + kbRows * 80 + 24;
    } else {
      ph = 140 + visible * rowH + 40;
    }
    if (ph > C.SPH) ph = C.SPH;
    var py = Math.round((1080 - ph) / 2);
    out.push(P.box(0, 0, 1920, 1080, { backgroundColor: "rgba(0,0,0,0.92)" }));
    out.push(P.box(C.SPX, py, C.SPW, ph, {
      backgroundColor: "#000000",
      border: "2px solid " + kit.INK
    }));
    out = out.concat(P.pxText(SETTINGS_TITLES[page] || "HOME SETTINGS", 6,
      kit.INK, C.SPX + 36, py + 30));
    out.push(P.mono(C.SPX + C.SPW - 620, py + 44, 584, 16,
      SETTINGS_HINTS[page] || "", kit.DIM, "right"));

    if (page === "name") {
      // Draft line, then the 6x6 keyboard. Digits live in the keyboard,
      // not on the remote, because remote digits are the page numbers.
      out.push(P.box(C.SPX + 24, py + 140, C.SPW - 48, 84, {
        backgroundColor: "#000000",
        border: "2px solid " + kit.GRID
      }));
      out.push(P.box(C.SPX + 44, py + 140, C.SPW - 240, 84, {
        fontFamily: kit.MONO, fontSize: 34, lineHeight: 84, color: kit.INK,
        whiteSpace: "pre"
      }, [String(vm.nameDraft || ""), P.h("span", { style: { color: kit.AMBER } }, "\u258c")]));
      out.push(P.mono(C.SPX + C.SPW - 224, py + 168, 180, 16,
        String((vm.nameDraft || "").length) + "/" + kit.NAME_MAX, kit.DIM, "right"));
      var cellW = Math.floor((C.SPW - 48 - 5 * 10) / kit.KB_COLS);
      for (var k = 0; k < kit.KB_CELLS.length; k++) {
        var cell = kit.KB_CELLS[k];
        var col = k % kit.KB_COLS, kbRow = Math.floor(k / kit.KB_COLS);
        var cx = C.SPX + 24 + col * (cellW + 10);
        var cy = py + 260 + kbRow * 80;
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

    var listY = py + 140;
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
    vm.mtick; // marquee re-render dependency: the heartbeat bumps it
              // while a long name is scrolling, and Vue repaints.
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
