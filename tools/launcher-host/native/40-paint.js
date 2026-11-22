/* Module 40 — paint primitives.
 *
 * Every visual atom the page modules compose from, built once per render
 * with the stage scale S = width / 1920 (self.innerWidth: the launcher
 * WebView lays out at 1920 on this panel today, and if the viewport ever
 * unlocks to 3840 the same code runs at S=2 with no doubling — that is
 * what the owner's "no upscaling artifacts" fix is, next to the pixel
 * font and the integer rounding below).
 *
 * box() rounds every dimension to an integer device pixel and never
 * emits fractions; pxText() draws the 5x7 face as flat fills on the even
 * grid. No borders below 2px, no opacity tricks on chrome type.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;

  kit.makePaint = function (h, scale) {
    var S = scale > 0 ? scale : 1;
    function r(n) { return Math.round(n * S); }

    // Numbers in the style bag are stage lengths and get scaled;
    // opacity/zIndex are plain numbers, strings pass through untouched.
    function styleOf(bag) {
      var out = {};
      if (!bag) return out;
      for (var k in bag) {
        if (!Object.prototype.hasOwnProperty.call(bag, k)) continue;
        var v = bag[k];
        if (typeof v === "number" && k !== "opacity" && k !== "zIndex") {
          out[k] = r(v) + "px";
        } else {
          out[k] = v;
        }
      }
      return out;
    }

    function box(x, y, w, height, style, children) {
      var st = styleOf(style);
      st.position = "absolute";
      st.left = r(x) + "px";
      st.top = r(y) + "px";
      if (w != null) st.width = r(w) + "px";
      if (height != null) st.height = r(height) + "px";
      return h("div", { style: st }, children);
    }

    function fillRect(x, y, w, height, color) {
      return box(x, y, w, height, { backgroundColor: color });
    }

    // Focus ring: sits on the block's edge, thick enough to survive
    // doubling (4 stage px at S=1 becomes an 8 device-px line, hard
    // edged because it is a solid border on aligned bounds).
    function ring(x, y, w, height, thick, color) {
      return box(x - thick, y - thick, w + thick * 2, height + thick * 2, {
        border: Math.max(2, r(thick)) + "px solid " + color,
        boxSizing: "border-box"
      });
    }

    function textWidth(str, unit) {
      return String(str).length * 6 * unit - unit;
    }

    // The pixel face: one div per lit run, all coordinates rounded once.
    function pxText(str, unit, color, x, y) {
      str = String(str);
      var out = [];
      var cell = Math.max(1, r(unit));
      for (var ci = 0; ci < str.length; ci++) {
        var rows = kit.glyphRows(str.charAt(ci));
        for (var row = 0; row < 7; row++) {
          var col = 0;
          while (col < 5) {
            if (rows.charAt(row * 5 + col) === "#") {
              var runLen = 1;
              while (col + runLen < 5 && rows.charAt(row * 5 + col + runLen) === "#") runLen++;
              out.push(h("div", { style: {
                position: "absolute",
                left: Math.round((x + (ci * 6 + col) * unit) * S) + "px",
                top: Math.round((y + row * unit) * S) + "px",
                width: Math.max(1, Math.round(runLen * unit * S)) + "px",
                height: cell + "px",
                backgroundColor: color
              } }));
              col += runLen;
            } else col++;
          }
        }
      }
      return out;
    }

    // Real monospace for the dense lists (settings rows and the
    // name keyboard): readable at 20px+, and the doubling softens
    // these into ordinary slightly-soft text, which is acceptable
    // for 40-character lists — the chrome type that must stay crisp
    // uses px.
    function mono(x, y, width, size, value, color, align) {
      return box(x, y, width, Math.round(size * 1.4), {
        fontFamily: kit.MONO,
        fontSize: size,
        lineHeight: Math.round(size * 1.4),
        color: color || kit.INK,
        textAlign: align || "left",
        whiteSpace: "pre"
      }, String(value));
    }

    function chip(x, y, color) {
      return fillRect(x, y, 22, 22, color);
    }

    return {
      h: h,
      S: S,
      r: r,
      box: box,
      fillRect: fillRect,
      ring: ring,
      pxText: pxText,
      textWidth: textWidth,
      mono: mono,
      chip: chip
    };
  };
}(self));
