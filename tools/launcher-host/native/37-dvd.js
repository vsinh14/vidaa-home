/* Module 37 — DVD bounce (owner feature, 2026-11-23).
 *
 * Zen mode (lid collapsed: chrome fades, clock + date are the ONLY
 * elements on bare art) + 10 s of stillness, and that clock+date block
 * rides the screen like the bouncing DVD logo: 45° diagonal, ~75 px/s,
 * reflecting off the page edges. One grouped block, single ink — both
 * choices locked by the owner when the feature was requested. Waking
 * zen (any key) restores the chrome, so the moving pair disappears and
 * only the top-left corner clock/date remains — which is exactly how
 * the zen layer already tears down; this module owns MOTION only.
 *
 * State lives on kit.dvd (deliberately not Vue-reactive): the 100 ms
 * tick calls $forceUpdate, same trick the 333 ms beat already uses;
 * the zen page is tiny (wallpaper box + a few hundred glyph blocks),
 * so re-rendering it at 10 Hz is cheap on Cobalt.
 *
 * The renderer (50-pages, zen branch) measures the block every pass —
 * kit.dvd.w/h — and publishes its resting slot (rx/ry) so arm() can
 * start the logo exactly where it already sits: no jump at arm time.
 * Widths are digit-count-stable (p2 hours, p2 day), so the measured
 * box never changes mid-bounce in practice.
 *
 * Wake paths do NOT call stop(): 34-keys clears vm.zen directly, and
 * vm.zen is reactive so the re-render that removes the layer happens
 * by itself; the next tick sees !vm.zen and tears the timers down.
 */
(function (self) {
  "use strict";
  var kit = self.AlvidaaNativeKit;
  var SPEED = 75;      // px/s — owner-locked classic DVD pace
  var ARM_MS = 10000;  // owner-locked: 10 s of zen before the bounce
  var TICK = 100;      // 10 Hz motion
  var DIAG = SPEED / Math.SQRT2;

  var d = {
    active: false, x: 0, y: 0, w: 0, h: 0, rx: 24, ry: 24,
    vx: 0, vy: 0, timer: null, arm: null, vm: null
  };

  function stop() {
    if (d.arm) { clearTimeout(d.arm); d.arm = null; }
    if (d.timer) { clearInterval(d.timer); d.timer = null; }
    d.active = false;
  }

  function arm() {
    d.arm = null;
    var vm = d.vm;
    if (!vm || !vm.zen) return;
    // Start exactly where the resting layout draws the block.
    d.x = d.rx;
    d.y = d.ry;
    // One of the four 45° diagonals — random sign each arm.
    d.vx = (Math.random() < 0.5 ? -1 : 1) * DIAG;
    d.vy = (Math.random() < 0.5 ? -1 : 1) * DIAG;
    // The first step may find w/h unmeasured (render has run at least
    // once before zen arms — zenTick runs after a paint — but guard.
    if (!d.w || !d.h) { d.w = 377; d.h = 143; }
    d.active = true;
    d.timer = setInterval(tick, TICK);
    force();
  }

  function tick() {
    var vm = d.vm;
    if (!vm || !vm.zen) { stop(); return; }
    var step = TICK / 1000;
    d.x += d.vx * step;
    d.y += d.vy * step;
    var maxX = 1920 - d.w, maxY = 1080 - d.h;
    if (d.x <= 0) { d.x = 0; d.vx = -d.vx; }
    else if (d.x >= maxX) { d.x = maxX; d.vx = -d.vx; }
    if (d.y <= 0) { d.y = 0; d.vy = -d.vy; }
    else if (d.y >= maxY) { d.y = maxY; d.vy = -d.vy; }
    force();
  }

  function force() {
    var vm = d.vm;
    if (vm && typeof vm.$forceUpdate === "function") {
      try { vm.$forceUpdate(); } catch (e) { void e; }
    }
  }

  // Lifecycle: zenTick sets vm.zen and calls kit.dvdStart(this);
  // the settings toggle re-arms live. Every teardown is self-service
  // from the tick guard.
  kit.dvd = d;
  kit.dvdStart = function (vm) {
    stop();
    d.vm = vm;
    if (vm.prefs && vm.prefs.dvd === false) return;
    if (typeof setTimeout !== "function" || typeof setInterval !== "function") return;
    d.arm = setTimeout(arm, ARM_MS);
  };
  kit.dvdStop = function () { stop(); };
}(self));
