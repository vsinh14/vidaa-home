/* Module 50 — the pages.
 *
 * P100 (Home): clock and date in the pixel face, page number top right in
 * cyan, tuner line with a live dot, the wallpaper band, and the brand-
 * block rail — six blocks, page-numbered 101..118, the brand fill
 * carrying the tile and white/red ring chrome carrying the launcher.
 *
 * P110 (Inputs): the same frame on the next page number, a 12-tile port
 * grid with live dots and digit numbers, the cue pointing back.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;
  var C = kit.C;

  kit.pageChrome = function (P, vm, pageNumber, sub) {
    var out = [];
    var now = vm.now || new Date();
    var clock = kit.p2(now.getHours()) + ":" + kit.p2(now.getMinutes());
    out = out.concat(P.pxText(clock, 13, kit.INK, C.MARGIN, 48));
    var date = (kit.DAYS[now.getDay()] + " " + kit.p2(now.getDate()) +
      " " + kit.MONTHS[now.getMonth()]).toUpperCase();
    out = out.concat(P.pxText(date, 4, kit.DIM, C.MARGIN, 172));
    out = out.concat(P.pxText(pageNumber, 7, kit.CYAN,
      C.RIGHT - P.textWidth(pageNumber, 7), 48));
    if (sub) out = out.concat(P.pxText(sub, 4, kit.DIM, C.MARGIN, 172));
    return out;
  };

  kit.pageFooter = function (P, vm) {
    var out = [];
    var y = C.FOOT_Y;
    var words = [];
    // chip + word pairs: colour keys explained where they are used.
    words.push([C.MARGIN, kit.RED, "EDIT"]);
    var greenX = C.MARGIN + 32 + P.textWidth("EDIT", 4) + 32;
    words.push([greenX, kit.GREEN, "LAUNCH"]);
    var yellowX = greenX + 32 + P.textWidth("LAUNCH", 4) + 32;
    words.push([yellowX, kit.YELLOW, "APPS"]);
    for (var i = 0; i < words.length; i++) {
      out.push(P.chip(words[i][0], y + 3, words[i][1]));
      out = out.concat(P.pxText(words[i][2], 4, kit.INK, words[i][0] + 32, y));
    }
    return out;
  };

  kit.renderHome = function (P, vm) {
    var out = kit.pageChrome(P, vm, "P100");

    // Tuner line: the live port (or last-used), right-aligned, with the
    // signal dot as a hard square on the even grid.
    var live = vm.sources.filter(kit.signalOf);
    var shown = live.length ? live[0] : null;
    if (!shown && vm.prefs && vm.prefs.lastUsed != null) {
      var lastStr = String(vm.prefs.lastUsed);
      for (var li = 0; li < vm.sources.length; li++) {
        if (String(vm.sources[li].sourceId) === lastStr) { shown = vm.sources[li]; break; }
      }
    }
    var tuner = shown ? String(vm.sourceName(shown)).toUpperCase() : "NO SOURCE";
    tuner = kit.trunc(tuner, 14);
    var dotOn = !!(shown && kit.signalOf(shown));
    var dot = 14, gap = 10;
    var tx = C.RIGHT - P.textWidth(tuner, 4) - (shown ? dot + gap : 0);
    out = out.concat(P.pxText(tuner, 4, shown ? kit.INK : kit.DIM, tx, 120));
    if (shown) out.push(P.fillRect(C.RIGHT - dot, 122, dot, dot, dotOn ? kit.GREEN : kit.FAINT));

    // The wallpaper band: blank by design, the art does the talking.
    out.push(P.box(0, C.BAND_Y, 1920, C.BAND_H, kit.wallpaperStyle()));

    // Brand-block rail, six per block; the block position follows focus.
    var items = vm.favoriteItems();
    var block = Math.floor(vm.fav / C.RAIL_PAGE) * C.RAIL_PAGE;
    for (var i = 0; i < C.RAIL_PAGE; i++) {
      var idx = block + i;
      var x = C.RAIL_X + i * (C.TILE_W + C.RAIL_GAP);
      if (idx >= items.length) {
        if (items.length === 0 && i === 0) {
          out.push(P.box(x, C.RAIL_Y, C.TILE_W, C.TILE_H,
            { border: "2px solid " + kit.GRID, backgroundColor: "#000000" }));
          var hint = "PIN APPS";
          out = out.concat(P.pxText(hint, 3, kit.FAINT,
            x + (C.TILE_W - P.textWidth(hint, 3)) / 2, C.RAIL_Y + 62));
        }
        continue;
      }
      var it = items[idx];
      out.push(P.box(x, C.RAIL_Y, C.TILE_W, C.TILE_H, { backgroundColor: it.fill }));
      var letter = String(it.label || "?").toUpperCase().slice(0, 1);
      out = out.concat(P.pxText(letter, 11, it.ink, x + 12, C.RAIL_Y + 10));
      var num = String(101 + idx);
      out = out.concat(P.pxText(num, 4, it.ink,
        x + C.TILE_W - 14 - P.textWidth(num, 4), C.RAIL_Y + 14));
      var lbl = String(it.label || "").toUpperCase().slice(0, 8);
      out = out.concat(P.pxText(lbl, 4, it.ink, x + 12, C.RAIL_Y + C.TILE_H - 44));
      if (idx === vm.fav) {
        out.push(P.ring(x, C.RAIL_Y, C.TILE_W, C.TILE_H, 4, vm.edit ? kit.RED : kit.INK));
      }
    }

    // Footer: key chips on the left, the page cue on the right. In edit
    // mode the cue turns red and says what OK will do.
    out = out.concat(kit.pageFooter(P, vm));
    if (vm.edit) {
      var editCue = "OK REMOVE RED EXIT";
      out = out.concat(P.pxText(editCue, 4, kit.RED,
        C.RIGHT - P.textWidth(editCue, 4), C.FOOT_Y));
    } else {
      var cue = "P110 INPUTS >";
      out = out.concat(P.pxText(cue, 4, kit.AMBER,
        C.RIGHT - P.textWidth(cue, 4), C.FOOT_Y));
    }
    return out;
  };

  kit.renderInputs = function (P, vm) {
    var out = kit.pageChrome(P, vm, "P110");
    var title = "INPUTS";
    // The page word sits under the clock, the sub-line under the date.
    out = out.concat(P.pxText(title, 7, kit.INK, C.MARGIN, 116));
    var sub = "PICK A PORT PRESS OK";
    out = out.concat(P.pxText(sub, 3, kit.DIM, C.MARGIN, 200));

    var block = Math.floor(vm.inputSel / C.INP_PAGE) * C.INP_PAGE;
    if (!vm.sources.length) {
      var x0 = C.INP_X, hint0 = "NO INPUTS REPORTED";
      out.push(P.box(x0, C.INP_Y, C.TILE_W, C.TILE_H,
        { border: "2px solid " + kit.GRID, backgroundColor: "#000000" }));
      out = out.concat(P.pxText(hint0, 3, kit.FAINT,
        x0 + (C.TILE_W - P.textWidth(hint0, 3)) / 2, C.INP_Y + 62));
    }
    for (var i = 0; i < C.INP_PAGE; i++) {
      var idx = block + i;
      if (idx >= vm.sources.length) break;
      var input = vm.sources[idx];
      var col = i % C.INP_COLS, row = Math.floor(i / C.INP_COLS);
      var x = C.INP_X + col * (C.TILE_W + C.INP_GAPX);
      var y = C.INP_Y + row * (C.TILE_H + C.INP_GAPY);
      var live = kit.signalOf(input);
      out.push(P.box(x, y, C.TILE_W, C.TILE_H, {
        backgroundColor: "#000000",
        border: "2px solid " + kit.GRID
      }));
      var port = (kit.text(input.name) || String(input.sourceId)).toUpperCase().slice(0, 6);
      out = out.concat(P.pxText(port, 5, kit.INK, x + 12, y + 12));
      var num = idx + 1 === 10 ? "0" : String(idx + 1);
      out = out.concat(P.pxText(num, 4, kit.FAINT,
        x + C.TILE_W - 14 - P.textWidth(num, 4), y + 14));
      var name = String(vm.sourceName(input)).toUpperCase().slice(0, 9);
      out = out.concat(P.pxText(name, 3, live ? kit.INK : kit.DIM, x + 12, y + C.TILE_H - 33));
      if (live) out.push(P.fillRect(x + C.TILE_W - 22, y + C.TILE_H - 32, 12, 12, kit.GREEN));
      else out.push(P.fillRect(x + C.TILE_W - 22, y + C.TILE_H - 32, 12, 12, "#1e1e1e"));
      if (idx === vm.inputSel) out.push(P.ring(x, y, C.TILE_W, C.TILE_H, 4, kit.INK));
    }

    // Footer: switching and the Apps grid are the keys that make sense
    // without the rail's EDIT.
    var yF = C.FOOT_Y;
    out.push(P.chip(C.MARGIN, yF + 3, kit.GREEN));
    out = out.concat(P.pxText("SWITCH", 4, kit.INK, C.MARGIN + 32, yF));
    var yellowX = C.MARGIN + 32 + P.textWidth("SWITCH", 4) + 32;
    out.push(P.chip(yellowX, yF + 3, kit.YELLOW));
    out = out.concat(P.pxText("APPS", 4, kit.INK, yellowX + 32, yF));
    var cue = "< P100 HOME";
    out = out.concat(P.pxText(cue, 4, kit.AMBER,
      C.RIGHT - P.textWidth(cue, 4), yF));
    return out;
  };
}(self));
