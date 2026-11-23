/* Module 50 — the pages.
 *
 * P100 (Home): clock and date in the pixel face, the wallpaper band, and the brand-
 * block rail — seven-up, the brand fill carrying the tile and
 * white/red ring chrome carrying the launcher. The rail wears no
 * numbers: the digits live on the remote. The corner carries the
 * plain words HOME and INPUTS in the cyan slot; the foot cues point
 * at the other page.
 *
 * P110 (Inputs): the same frame, a 12-tile port
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
    var date = (kit.DAYS[now.getDay()] + " " + kit.p2(now.getDate()) +
      " " + kit.MONTHS[now.getMonth()]).toUpperCase();
    if (vm.zen) {
      // Zen state: time and date on bare wallpaper. The ink is
      // sampled from the wallpaper patch the glyphs actually sit
      // on, and four offset halo copies in the OPPOSITE colour
      // guarantee legibility anywhere on any wallpaper — no
      // background box, ever (owner, 2026-11-22).
      // Block geometry first: the ink is chosen from the art the
      // block ACTUALLY sits on, and the DVD engine needs the
      // measure every pass.
      var bw = Math.max(P.textWidth(clock, 13), P.textWidth(date, 4));
      var bh = (C.DATE_Y - C.CLOCK_Y) + 7 * 4;
      var gx = C.MARGIN, gy = C.CLOCK_Y;
      if (kit.dvd) {
        kit.dvd.w = bw;
        kit.dvd.h = bh;
        kit.dvd.rx = gx;
        kit.dvd.ry = gy;
        if (kit.dvd.active) { gx = kit.dvd.x; gy = kit.dvd.y; }
        // Eraser REMOVED (owner, 2026-11-23): an art-slice patch
        // re-rasterizes independently of the wallpaper box, and
        // the seams it left around the moving logo were worse than
        // the residue it covered. The cobalt vacated-rect bug stays
        // open (see skill); do not re-add slice boxes.
      }
      // Manifest tile luma (kit.inkForRect): the block picks white
      // or black ink from the art it currently covers — follows it
      // during the bounce, survives mid-zen wallpaper swaps, and
      // needs no canvas reads on the panel. Falls back to the
      // canvas-sampled zenInk when no manifest luma exists.
      var ink = kit.inkForRect(self.AlvidaaNativeWallpaperLum, gx, gy, bw, bh) ||
        vm.zenInk || kit.INK;
      var halo = kit.haloFor(ink);
      var dateY = gy + (C.DATE_Y - C.CLOCK_Y);
      var offs = [[-1, 0], [1, 0], [0, -1], [0, 1]], oi;
      for (oi = 0; oi < 4; oi++) {
        out = out.concat(P.pxText(clock, 13, halo,
          gx + offs[oi][0], gy + offs[oi][1]));
      }
      out = out.concat(P.pxText(clock, 13, ink, gx, gy));
      for (oi = 0; oi < 4; oi++) {
        out = out.concat(P.pxText(date, 4, halo,
          gx + offs[oi][0], dateY + offs[oi][1]));
      }
      out = out.concat(P.pxText(date, 4, ink, gx, dateY));
      return out;
    }
    out = out.concat(P.pxText(clock, 13, kit.INK, C.MARGIN, C.CLOCK_Y));
    out = out.concat(P.pxText(date, 4, kit.DIM, C.MARGIN, C.DATE_Y));
    // The corner slot carries the page's plain word (HOME, INPUTS) in
    // ink u7 — same white as the clock and rail text, so nothing on a
    // default panel competes with the wallpaper for attention.
    if (pageNumber) out = out.concat(P.pxText(pageNumber, 7, kit.INK,
      C.RIGHT - P.textWidth(pageNumber, 7), C.TOP));
    if (sub) out = out.concat(P.pxText(sub, 4, kit.DIM, C.MARGIN, C.DATE_Y));
    return out;
  };

  // The left-hand legend, in one place so both pages draw the same
  // chain and Inputs can extend it without duplicating it. Order is
  // the owner's (2026-11-22): APPS first, GREEN (the vendor's TV
  // settings) second, BLUE (this launcher's own settings — the page
  // that previously had no button door at all) third, EDIT last and
  // home-only; P110 keeps no edit mode. Every option word is five
  // characters or fewer (owner, 2026-11-22): the chip carries the
  // colour, the word only has to name the door.
  kit.footWords = function (P, vm) {
    var out = [];
    var x = C.MARGIN;
    out.push([x, kit.YELLOW, "APPS"]);
    x += 32 + P.textWidth("APPS", 4) + 32;
    out.push([x, kit.GREEN, "TV"]);
    x += 32 + P.textWidth("TV", 4) + 32;
    out.push([x, kit.BLUE, "HOME"]);
    x += 32 + P.textWidth("HOME", 4) + 32;
    if (vm.page !== "inputs") out.push([x, kit.RED, "EDIT"]);
    return out;
  };

  kit.pageFooter = function (P, vm) {
    var out = [];
    var y = C.FOOT_Y;
    // chip + word pairs: colour keys explained where they are used.
    var words = kit.footWords(P, vm);
    for (var i = 0; i < words.length; i++) {
      out.push(P.chip(words[i][0], y + 3, words[i][1]));
      out = out.concat(P.pxText(words[i][2], 4, kit.INK, words[i][0] + 32, y));
    }
    return out;
  };

  // Full-page art, flat translucent header scrim, and the near-black
  // superblock that carries the rail and the foot as one unit — the
  // apps sit in their own block, the owner's original decision. With
  // the rail's lid closed the block keeps only the foot. Painted first
  // so text and tiles land on top.
  kit.pageBackdrop = function (P, vm) {
    var out = [];
    if (vm.zen) {
      // Zen: wallpaper only. No scrim band, no super band — the
      // clock sits bare on the art and the sampled ink + halo
      // carry the contrast instead of a background (owner, 2026-11-22).
      out.push(P.box(0, 0, 1920, 1080, kit.wallpaperStyle()));
      return out;
    }
    // Lid down: foot band only. Lid up: one rail tall. Expanded
    // Inputs: the block grows to cover both rows.
    var top = !vm.railOpen ? C.SUPER_FOOT_Y :
      (vm.page === "inputs" && vm.inputsExpanded) ? C.SUPER_EXP_Y : C.SUPER_Y;
    out.push(P.box(0, 0, 1920, 1080, kit.wallpaperStyle()));
    out.push(P.box(0, 0, 1920, C.BAND_Y, { backgroundColor: kit.SCRIM }));
    out.push(P.box(0, top, 1920, 1080 - top, { backgroundColor: kit.SUPER }));
    return out;
  };

  // One rail, two lives: Home carries the favourites, Inputs carries
  // the ports (and, when expanded, a data row riding above them). Same
  // tile shape, same page window, same ring, same lid — one renderer,
  // nothing to drift. Tiles arrive pre-built by the page that owns
  // them; y says which row of the stage the call paints (default: the
  // bottom rail Home and the folded Inputs share).
  // ringOn (optional, default true): one page, one selector. When a
  // page stacks two rows, only the focused row paints a ring — the
  // unfocused row keeps its selection index for paging continuity
  // but wears no ring, so exactly one block is ever selected.
  kit.railRow = function (P, vm, tiles, sel, hint, y, ringOn) {
    var out = [];
    if (!vm.railOpen) return out;   // the lid covers the row
    var ry = y == null ? C.RAIL_Y : y;
    var block = Math.floor(sel / C.RAIL_PAGE) * C.RAIL_PAGE;
    for (var i = 0; i < C.RAIL_PAGE; i++) {
      var idx = block + i;
      var x = C.RAIL_X + i * (C.TILE_W + C.RAIL_GAP);
      if (idx >= tiles.length) {
        if (tiles.length === 0 && i === 0 && hint) {
          out.push(P.box(x, ry, C.TILE_W, C.TILE_H,
            { border: "2px solid " + kit.GRID, backgroundColor: "#000000" }));
          out = out.concat(P.pxText(hint, 3, kit.FAINT,
            x + (C.TILE_W - P.textWidth(hint, 3)) / 2, ry + 62));
        }
        continue;
      }
      var t = tiles[idx];
      out.push(P.box(x, ry, C.TILE_W, C.TILE_H, t.style));
      out = out.concat(P.pxText(t.letter, 11, t.letterInk, x + 12, ry + 10));
      if (t.num) out = out.concat(P.pxText(t.num, 4, t.numInk,
        x + C.TILE_W - 14 - P.textWidth(t.num, 4), ry + 14));
      if (t.labelFull || t.labelWord) {
        // The label lane (owner-locked, 2026-11-22): every block
        // shows ONE WORD; the block the ring rests on shows the
        // FULL name — static when 11 chars fill the lane,
        // scrolling through the whole name when it runs past.
        var L = kit.tileLabel(t.labelFull, t.labelWord);
        var LW = kit.LABEL_W;
        if (idx === sel && ringOn !== false) {
          // The beat and the walk live in kit.labelPaint — the rail
          // and the drawer are one language and must not be two
          // implementations; the lane width here and the guard's
          // lane read the same constants.
          out = out.concat(kit.labelPaint(P, vm, L, t.labelInk,
            x + 12, ry + C.TILE_H - 44, 4, LW));
        } else {
          out = out.concat(P.pxText(L.word.slice(0, LW), 4, t.labelInk,
            x + 12, ry + C.TILE_H - 44));
        }
      }
      if (idx === sel && ringOn !== false) out.push(P.ring(x, ry, C.TILE_W, C.TILE_H, 4, t.ring || kit.INK));
    }
    return out;
  };

  kit.renderHome = function (P, vm) {
    var out = kit.pageBackdrop(P, vm);
    out = out.concat(kit.pageChrome(P, vm, "HOME"));

    // No tuner line on Home: whatever port the TV last held is not what
    // the viewer is watching while standing in the home page — it was a
    // wrong fact wearing good pixels. Live state lives on the inputs
    // page, where it means something.

    // Brand blocks: the fill carries the colour decision, the railRow
    // carries everything else. No numbers: the P1xx page codes were
    // pattern bookkeeping, not app truth — the letter and the name
    // already say everything (owner, 2026-11-22).
    var items = vm.favoriteItems();
    var tiles = [];
    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      // One WORD sits on an unselected block (shortName, as ever);
      // the ring block reads the full name — railRow decides.
      var full = kit.text(it.app && it.app.appName).trim().toUpperCase();
      tiles.push({
        style: { backgroundColor: it.fill },
        letter: full ? full.slice(0, 1) : "?",
        letterInk: it.ink,
        num: "",
        labelFull: full.slice(0, 60),
        labelInk: it.ink,
        ring: vm.edit ? kit.RED : kit.INK
      });
    }
    out = out.concat(kit.railRow(P, vm, tiles, vm.fav, "PIN APPS"));

    // Footer: key chips on the left, the page cue on the right — as
    // before. In edit mode the cue turns red and says what OK will do.
    // Zen: the foot is gone entirely (owner, 2026-11-22).
    if (!vm.zen) {
      out = out.concat(kit.pageFooter(P, vm));
      if (vm.edit) {
        out = out.concat(kit.rightFoot(P,
          "UP DOWN MOVE   OK REMOVE   RED EXIT", kit.RED, C.FOOT_Y));
      } else {
        out = out.concat(kit.rightFoot(P, "INPUTS >", kit.DIM, C.FOOT_Y));
      }
    }
    return out;
  };

  kit.renderInputs = function (P, vm) {
    var out = kit.pageBackdrop(P, vm);
    out = out.concat(kit.pageChrome(P, vm, "INPUTS"));
    // No how-to hint: the rail and the foot cue carry the page; telling
    // someone to press a port they can see is noise.

    // Split rail (owner-locked design): the vendor's own labels sort
    // the sources — kit.isPort puts the physical ports (HDMI/AV/SC/
    // COMPONENT names) on the bottom row, everything else (tuner,
    // cast, mirror...) on the data row that rides above. Placement is
    // the ONLY thing rows change: every tile, on either row, folded
    // or expanded, carries the same payload — big port letter, the
    // physical port code in the top slot, the device title at the
    // bottom — and the same colors (deviceOf truth: a reporting
    // device greens its whole tile, a bare slot stays grey). Renames
    // never move a source between rows.
    var rows = vm.inputRows();
    var data = rows[0], ports = rows[1];
    function tileFor(input) {
      var live = kit.deviceOf(input) !== "";
      var custom = String(vm.sourceName(input)).toUpperCase();
      var pname = (kit.text(input.name) || "").toUpperCase();
      var named = custom && custom !== pname;
      var ink = live ? kit.GREEN : kit.DIM;
      return {
        style: { backgroundColor: "#000000",
          border: "2px solid " + (live ? kit.GREEN : kit.GRID) },
        letter: (pname || custom || "?").slice(0, 1),
        letterInk: ink,
        num: named ? pname.slice(0, 6) : "",
        numInk: live ? kit.GREEN : kit.FAINT,
        labelFull: (custom || pname || "").slice(0, 60),
        labelWord: kit.shortName(custom || pname || ""),
        labelInk: ink
      };
    }
    // Each row pages itself: railRow derives the window from that
    // row's own selection, so the two rows page independently.
    if (vm.railOpen && vm.inputsExpanded && data.length) {
      var dt = [];
      for (var d = 0; d < data.length; d++) dt.push(tileFor(data[d]));
      out = out.concat(kit.railRow(P, vm, dt, vm.inputDataSel, null, C.RAIL2_Y,
        vm.inputRow === 0));
    }
    var tiles = [];
    for (var p = 0; p < ports.length; p++) tiles.push(tileFor(ports[p]));
    out = out.concat(kit.railRow(P, vm, tiles, vm.inputSel,
      vm.sources.length ? null : "NO INPUTS REPORTED", C.RAIL_Y,
      vm.inputRow === 1));

    // Footer: the Apps grid key, the row cue when a hidden data row
    // exists, and the cue home. The cue tracks ROW STATE, not focus:
    // it promises "UP raises a data row", so it shows whenever that
    // promise is live (rail up, folded, data exists) and vanishes
    // while the data row is already on screen. Where the ring sits
    // changes nothing — the cue speaks to the row, not the selector.
    var yF = C.FOOT_Y;
    if (vm.zen) return out;   // zen: no foot cues at all
    out = out.concat(kit.pageFooter(P, vm));
    if (data.length && vm.railOpen && !vm.inputsExpanded) {
      // DATA joins the legend pattern (owner, 2026-11-22): the caret
      // sits in the chip's footprint — same slot x, vertically
      // centred against the 22 px block row — and the word lands in
      // the +32 word lane like every other option's. Grey, because
      // it is a row cue, not a colour key.
      var legend = kit.footWords(P, vm);
      var last = legend[legend.length - 1];
      var dataX = last[0] + 32 + P.textWidth(last[2], 4) + 32;
      out = out.concat(P.pxText("^", 3, kit.DIM, dataX + 4, yF + 5));
      out = out.concat(P.pxText("DATA", 4, kit.DIM, dataX + 32, yF));
    }
    out = out.concat(kit.rightFoot(P, "< HOME", kit.DIM, yF));
    return out;
  };
}(self));
