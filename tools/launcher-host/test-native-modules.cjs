#!/usr/bin/env node
/* Headless exercise of the native/ modules: no Vue, no TV.
 *
 * Boots create(sdk) with a fake sdk + platform, pushes a payload, walks
 * the key model (pages, digits, edit mode, overlay, settings), and
 * renders every layer through a fake h() so the render path is proven to
 * run and to produce sane element counts. Run: node test-native-modules.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// native-platform.js is deliberately NOT loaded: sandbox provides the fake,
// and the module under test is the frontend contract, not the vendor bridge.
const PARTS = [
  'native/00-kit.js', 'native/10-glyphs.js', 'native/20-model.js',
  'native/30-lifecycle.js', 'native/32-settings.js', 'native/34-keys.js',
  'native/40-paint.js', 'native/50-pages.js', 'native/60-layers.js',
  'native/80-component.js'
];

const store = {};
const KEYMAP = {
  UP: 19, DOWN: 20, LEFT: 21, RIGHT: 22, ENTER: 13, BACK: 461, RETURN: 461,
  NUM_0: 48, NUM_1: 49, NUM_2: 50, NUM_3: 51, NUM_4: 52,
  NUM_5: 53, NUM_6: 54, NUM_7: 55, NUM_8: 56, NUM_9: 57,
  RED: 182, GREEN: 183, YELLOW: 184, BLUE: 185, MENU: 138
};
const calls = [];
const sandbox = {
  innerWidth: 1920,
  setInterval: () => 1, clearInterval() {},
  setTimeout: () => 1, clearTimeout() {},
  Date, JSON, Math, Number, Object, String, Array, parseInt, RegExp,
  document: { body: { addEventListener() {}, removeEventListener() {} } },
  addEventListener() {}, removeEventListener() {}
};
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.AlvidaaNativePlatform = function (sdk, cb) {
  return {
    start() { cb(payload); },
    stop() {},
    launchApp(id) { calls.push(['launch', id]); },
    changeSource(id) { calls.push(['source', id]); },
    openSettings() { calls.push(['stock-settings']); }
  };
};
const payload = {
  apps: [
    { appId: 'netflix', appName: 'Netflix' },
    { appId: 'yt', appName: 'YouTube: Watch' },
    { appId: 'prime', appName: 'Prime Video' },
    { appId: 'browser', appName: 'Browser' },
    { appId: 'vidaa-home', appName: 'Vidaa Home' }
  ],
  sources: [
    { sourceId: 1, name: 'HDMI1', deviceName: 'Fire TV Stick', is_signal: 1 },
    { sourceId: 2, name: 'HDMI2', deviceName: null, has_signal: 0 },
    { sourceId: 5, name: 'AV', deviceName: 'Roku', is_signal: 0 },
    { sourceId: 7, name: 'TV', deviceName: null, has_signal: 1 }
  ],
  errors: []
};
const sdk = {
  storage: { get: k => (k in store ? store[k] : undefined), set: (k, v) => { store[k] = v; } },
  key: { KEYMAP },
  router: { isCurrentPathEqualTo: () => true },
  tts: null, i18n: null
};

for (const file of PARTS) {
  let source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  // NATIVE_MIN=1 runs the same scenario against the minified form the
  // build ships, proving esbuild's pass preserves semantics, not just syntax.
  if (process.env.NATIVE_MIN) {
    const esbuild = require(require.resolve('esbuild', {
      paths: ['/home/lawliet/Documents/programs/deepseek-harness/node_modules/.pnpm']
    }));
    source = esbuild.transformSync(source,
      { minify: true, target: 'es2017', legalComments: 'none' }).code;
  }
  vm.runInNewContext(source, sandbox, { filename: file });
}
assert.equal(typeof sandbox.AlvidaaNativeComponent, 'function', 'component factory exported');

const opts = sandbox.AlvidaaNativeComponent(sdk);
assert.equal(opts.name, 'Launcher');
const v = Object.assign({}, opts.data(), opts.methods);

// Boot: the fake platform delivers the payload synchronously from start().
opts.mounted.call(v);
assert.equal(v.apps.length, 4, 'vidaa-home filtered out');
assert.equal(v.sources.length, 4);
assert.equal(v.page, 'home');

// The block's color truth is device presence, not naming: `deviceName`
// is filled only by a real device; the other name fields label every
// port and must never light a block up.
const kitK = sandbox.AlvidaaNativeKit;
assert.equal(kitK.deviceOf({ name: 'HDMI3', deviceName: 'JBL' }), 'JBL');
assert.equal(kitK.deviceOf({ name: 'HDMI3', displayname2: 'SCREEN' }), '', 'a label is no device');
assert.equal(kitK.deviceOf({ name: 'HDMI3', rename: 'HOME1' }), '', 'a rename is no device');
assert.equal(kitK.deviceOf({ name: 'HDMI3', deviceName: '  ' }), '', 'whitespace is no device');
assert.equal(kitK.deviceOf({ name: 'HDMI3' }), '', 'bare port is no device');
// Rail split truth: the vendor's own label classifies; renames never move.
assert.equal(kitK.isPort({ name: 'HDMI1' }), true, 'HDMI is a port');
assert.equal(kitK.isPort({ name: 'AV' }), true, 'AV is a port');
assert.equal(kitK.isPort({ name: 'COMPONENT' }), true, 'component is a port');
assert.equal(kitK.isPort({ name: 'TV' }), false, 'the tuner rides the data row');
assert.equal(kitK.isPort({ name: 'CHROMECAST' }), false, 'cast rides the data row');
assert.equal(kitK.isPort({ name: 'SC' }), true, 'SC is the SCART-era connector');
assert.equal(kitK.isPort({ name: 'SC1' }), true, 'SC with a number is a port');
assert.equal(kitK.isPort({ name: 'SCREEN SHARE' }), false,
  'screen share starts with SC but is not a connector (panel trap)');
assert.equal(kitK.isPort({ name: 'SCREEN' }), false, 'bare SCREEN is data, not SC');
assert.equal(v.inputRows()[1].length, 3, 'three ports on the bottom row');
assert.equal(v.inputRows()[0].length, 1, 'the tuner is the one data row tile');

// Pin three favorites through the settings actions.
v.togglePin(v.apps[0]);
v.togglePin(v.apps[1]);
v.togglePin(v.apps[2]);
v.clamp();
assert.equal(v.favoriteItems().length, 3);
const fb = v.favoriteItems()[0];
assert.equal(fb.fill, '#e50914', 'netflix brand block');
assert.equal(fb.ink, '#ffffff', 'dark brand gets white ink');
assert.equal(v.favoriteItems()[1].fill, '#ff0000', 'youtube brand block');

// Digit 2 launches slot 102 directly.
assert.equal(v.handleKey(KEYMAP.NUM_2), true);
assert.equal(v.fav, 1);
assert.deepEqual(calls[calls.length - 1], ['launch', 'yt']);

// RIGHT twice walks 102 -> 103 -> P110.
v.fav = 1; v.handleKey(KEYMAP.RIGHT); assert.equal(v.fav, 2);
v.handleKey(KEYMAP.RIGHT); assert.equal(v.page, 'inputs');
// P110: smart focus lands on the first port reporting a device
// (HDMI1); the fresh visit enters folded on the ports lane.
assert.equal(v.inputSel, 0);
assert.equal(v.inputRow, 1);
assert.equal(v.inputsExpanded, false, 'fresh Inputs enters folded');
// BACK on the open rail folds it IN PLACE: the page stays, the lid
// drops. The next BACK, in nav mode, is the page home.
v.handleKey(KEYMAP.BACK);
assert.equal(v.page, 'inputs', 'BACK folds the rail, it does not turn the page');
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.page, 'home');
// Re-entry (nav RIGHT with the lid down). Digits are dead on Inputs:
// folded, the digit just lifts the rail (blind rule, it does not
// punch through); open, nothing at all happens — the vendor keeps
// its channel keys.
v.handleKey(KEYMAP.RIGHT); assert.equal(v.page, 'inputs');
const preDigits = calls.length;
assert.equal(v.handleKey(KEYMAP.NUM_3), true, 'folded: the digit lifts, nothing else');
assert.equal(v.railOpen, true);
assert.equal(calls.length, preDigits, 'no switch through a closed lid');
assert.equal(v.handleKey(KEYMAP.NUM_3), false, 'open: digits are dead on Inputs');
// Walk to AV and launch.
v.handleKey(KEYMAP.RIGHT); v.handleKey(KEYMAP.RIGHT);
assert.equal(v.inputSel, 2, 'walked to AV, the last port');
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.deepEqual(calls[calls.length - 1], ['source', 5]);
assert.equal(JSON.parse(store.alvidaa_last_used), 5, 'last-used written');
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.deepEqual(calls[calls.length - 1], ['source', 5]);
assert.equal(JSON.parse(store.alvidaa_last_used), 5, 'last-used written');

// RED enters edit mode; OK removes the focused block. (First BACK
// folds the open rail in place, the second is the page home.)
v.handleKey(KEYMAP.BACK);
v.handleKey(KEYMAP.BACK); assert.equal(v.page, 'home');
v.fav = 0;
v.handleKey(KEYMAP.RED); assert.equal(v.edit, true);
v.handleKey(KEYMAP.ENTER);
assert.equal(v.favoriteItems().length, 2);
v.handleKey(KEYMAP.RED); assert.equal(v.edit, false);
// GREEN is bound to the vendor's TV sheet now (owner, 2026-11-22),
// so the press is claimed. UP at the P100 root stays the vendor's.
// DOWN is the rail's lid: it covers the row, and the next key's
// whole job is to lift it back.
assert.equal(v.handleKey(KEYMAP.GREEN), true);
assert.deepEqual(calls[calls.length - 1], ['stock-settings'], 'green = TV settings');
assert.equal(v.handleKey(KEYMAP.UP), false);
assert.equal(v.railOpen, true);
assert.equal(v.handleKey(KEYMAP.DOWN), true);
assert.equal(v.railOpen, false);
// Collapsed is navigation mode: RIGHT turns the page, it does not lift.
v.fav = 0;
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.page, 'inputs', 'collapsed RIGHT turns the page');
assert.equal(v.railOpen, false, 'navigation keeps the lid down');
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.page, 'home', 'collapsed LEFT turns back');
assert.equal(v.railOpen, false, 'the lid is shared across pages');
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.page, 'inputs');
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.page, 'home');
// Keys that want the rail lift the lid first — the lift is the whole
// action: nothing selects and nothing launches behind a closed lid.
const blindBefore = calls.length;
assert.equal(v.handleKey(KEYMAP.NUM_3), true);
assert.equal(v.railOpen, true, 'a digit lifts the lid, it does not punch through');
assert.equal(calls.length, blindBefore, 'no switch through a closed lid');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // cover again
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.equal(v.railOpen, true, 'OK lifts the lid, it does not fire blind');
assert.equal(calls.length, blindBefore, 'the lift is not a launch either');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // cover again
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.RIGHT), true);           // nav, stays closed
assert.equal(v.page, 'inputs');
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.railOpen, true, 'RIGHT with no next page lifts — the user is lost');
assert.equal(v.page, 'inputs', 'and the page stays put');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // cover again on Inputs
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.BACK), true);            // BACK still navigates closed
assert.equal(v.page, 'home', 'BACK turns back with the lid down');
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.RIGHT), true);           // nav in again
assert.equal(v.page, 'inputs');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // lift, no page turn
assert.equal(v.railOpen, true);
assert.equal(v.page, 'inputs', 'the lid never turns pages by itself');
// Open-state BACK on Inputs is an unwinder, not a page turn: it folds
// the rail in place; the next BACK, in nav mode, is the page home.
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.page, 'inputs', 'BACK folds the rail, Inputs stays put');
assert.equal(v.railOpen, false);
assert.equal(v.inputsExpanded, false);
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.page, 'home', 'the nav-mode BACK pages home');
assert.equal(v.railOpen, false, 'page nav keeps the lid down');
// 30 s of silence closes it (the tick is the heartbeat's sample).
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // lift on Home first
assert.equal(v.railOpen, true);
v.lastAct = Date.now() - 61000;
v.railLidTick(Date.now());
assert.equal(v.railOpen, false, 'silence closes the lid');
assert.equal(v.handleKey(KEYMAP.UP), true, 'UP lifts the rail too: only nav keys do not');
assert.equal(v.railOpen, true);
// Open-state: RIGHT past the rail end is how the open rail turns to P110.
v.fav = Math.max(0, v.favoriteItems().length - 1);
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.page, 'inputs');
assert.equal(v.railOpen, true, 'page nav keeps the rail open');
assert.equal(v.inputsExpanded, false, 'the fresh visit enters folded');
// Two-stage unwind: fold in place, then nav home.
v.handleKey(KEYMAP.BACK);
assert.equal(v.page, 'inputs');
assert.equal(v.railOpen, false);
v.handleKey(KEYMAP.BACK); assert.equal(v.page, 'home');

// Inputs split rail, open walk. Fixture ports: HDMI1, HDMI2, AV;
// data row: the tuner (one tile). Each row pages itself; the walk is
// continuous — data first, ports below.
assert.equal(v.handleKey(KEYMAP.RIGHT), true);           // nav in, lid down
assert.equal(v.page, 'inputs');
v.handleKey(KEYMAP.ENTER);                               // blind rule lifts
assert.equal(v.railOpen, true, 'the lid opens before anything walks');
assert.equal(v.inputsExpanded, false, 'fresh visit enters folded');
assert.equal(v.handleKey(KEYMAP.UP), true, 'UP raises the data row');
assert.equal(v.inputsExpanded, true);
assert.equal(v.inputRow, 1, 'expanding adds a lane, focus stays on the ports');
assert.equal(v.handleKey(KEYMAP.UP), true, 'UP again steps up the lane');
assert.equal(v.inputRow, 0);
assert.equal(v.handleKey(KEYMAP.UP), false, 'the data row is the top of the world');
// DOWN from the top row folds AND lands focus on the rail below.
assert.equal(v.handleKey(KEYMAP.DOWN), true);
assert.equal(v.inputsExpanded, false, 'the data row folded away');
assert.equal(v.inputRow, 1, 'focus descended to the ports row');
assert.equal(v.inputSel, 0, 'same column, clamped');
assert.equal(v.railOpen, true, 'folding one row leaves the rail open');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // folded: DOWN is the lid
assert.equal(v.railOpen, false);
// The continuous walk, backwards from the ports row start:
assert.equal(v.handleKey(KEYMAP.ENTER), true);           // lift again
assert.equal(v.handleKey(KEYMAP.UP), true);              // expand again
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.inputRow, 0, 'stepped into the far end of the data row');
assert.equal(v.inputDataSel, 0);
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.page, 'home', 'the walk start faces Home, lid or not');
assert.equal(v.railOpen, true, 'page nav keeps the rail open');
// And forwards: the data row end hands over to the ports row start.
v.fav = Math.max(0, v.favoriteItems().length - 1);
assert.equal(v.handleKey(KEYMAP.RIGHT), true);           // open nav back in
assert.equal(v.page, 'inputs');
assert.equal(v.inputsExpanded, false, 'the fresh visit enters folded again');
v.handleKey(KEYMAP.UP);                                  // expand
v.inputRow = 0;
v.inputDataSel = 0;                                      // only data tile: also its end
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.inputRow, 1);
assert.equal(v.inputSel, 0, 'the data end hands over to the ports start');
// Walk to the rail end and clamp there — no wrap, the walk just ends.
v.handleKey(KEYMAP.RIGHT); v.handleKey(KEYMAP.RIGHT);
assert.equal(v.inputSel, 2, 'the rail ends at its last port');
assert.equal(v.handleKey(KEYMAP.RIGHT), true);
assert.equal(v.inputSel, 2, 'past the end the rail simply ends');
// BACK anywhere on the open rail folds both rows to nav mode in place.
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.inputsExpanded, false, 'BACK folds both rows at once');
assert.equal(v.railOpen, false, 'and drops the lid');
assert.equal(v.page, 'inputs', 'the page stays put');
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.page, 'home', 'then the nav-mode BACK pages home');
// Folded, the ports row start is the walk start: LEFT faces Home.
assert.equal(v.handleKey(KEYMAP.RIGHT), true);           // nav in, lid down
assert.equal(v.page, 'inputs');
v.handleKey(KEYMAP.ENTER);                               // lift
assert.equal(v.railOpen, true);
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.page, 'home', 'folded rail start faces Home');
assert.equal(v.railOpen, true);
// Nav keys at a page boundary lift: a lost press shows the rail.
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // cover
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.LEFT), true);
assert.equal(v.railOpen, true, 'LEFT with no previous page lifts — the user is lost');
assert.equal(v.page, 'home', 'and the page stays put');
assert.equal(v.handleKey(KEYMAP.DOWN), true);            // cover again
assert.equal(v.railOpen, false);
assert.equal(v.handleKey(KEYMAP.BACK), false, 'BACK at Home is the vendor exit, lid or not');
// Foot legends act in both modes: the grid goes through the lid,
// RED lifts the rail and arms edit in one press.
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.overlay, true, 'YELLOW opens the grid straight through a closed lid');
assert.equal(v.railOpen, false, 'the lid stays down under the grid');
assert.equal(v.handleKey(KEYMAP.BACK), true);
assert.equal(v.overlay, false, 'BACK closes the grid');
assert.equal(v.railOpen, false, 'and hands back navigation mode');
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.railOpen, true, 'RED brings the rail back with edit on');
assert.equal(v.edit, true);
assert.equal(v.handleKey(KEYMAP.RED), true);   // open-state: RED exits edit
assert.equal(v.edit, false);

// Digit 5 hits an empty slot: consumed with a toast, nothing launched.
const before = calls.length;
assert.equal(v.handleKey(KEYMAP.NUM_5), true);
assert.equal(calls.length, before, 'empty rail slot must not launch');
assert.match(v.toast, /105 is empty/);

// YELLOW opens the overlay; DOWN clamps to the last app; ENTER launches.
v.handleKey(KEYMAP.YELLOW); assert.equal(v.overlay, true);
assert.equal(v.handleKey(KEYMAP.DOWN), true);
assert.equal(v.overlayIndex, 3, 'DOWN (+7) clamps to the last app');
v.handleKey(KEYMAP.ENTER);
assert.equal(v.overlay, false);
assert.deepEqual(calls[calls.length - 1], ['launch', 'browser']);
// RED is unbound inside the grid (owner, 2026-11-22): the key falls
// to the vendor and the grid stays put; YELLOW is the way back out.
v.handleKey(KEYMAP.YELLOW);
assert.equal(v.overlay, true, 'YELLOW re-opens the grid');
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.overlayEdit, true, 'RED edits the grid like the rail');
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.overlayEdit, false, 'RED exits the edit');
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.overlay, false, 'YELLOW exits apps mode');

// Launcher settings surface: rows, toggles, idle cycle, name editor.
v.openLauncherSettings();
const rows = v.settingsRows();
assert.ok(rows.some(r => r.kind === 'autoswitch'));
v.settingsIndex = rows.findIndex(r => r.kind === 'autoswitch');
v.handleKey(KEYMAP.RIGHT);
assert.equal(JSON.parse(store.alvidaa_auto_switch), true);
v.handleKey(KEYMAP.LEFT);
assert.equal(JSON.parse(store.alvidaa_auto_switch), false);
// idle row: step once to 1 min, then back to off
const idleRow = rows.findIndex(r => r.kind === 'idle');
v.settingsIndex = idleRow;
v.handleKey(KEYMAP.RIGHT);
assert.equal(v.prefs.idleMinutes, 1);
v.handleKey(KEYMAP.LEFT);
assert.equal(v.prefs.idleMinutes, 0);
// Name editor: type via the on-screen keyboard, DONE commits.
v.settingsIndex = rows.findIndex(r => r.kind === 'open-inputs');
v.handleKey(KEYMAP.ENTER); // open-inputs
v.settingsIndex = 0;
v.handleKey(KEYMAP.ENTER); // open name editor
assert.equal(v.settingsPage, 'name');
const kb = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
const idxOf = ch => kb.indexOf(ch);
v.nameIndex = idxOf('X'); v.handleKey(KEYMAP.ENTER);
v.nameIndex = idxOf('Y'); v.handleKey(KEYMAP.ENTER);
const done = 36 + 3; // DONE cell
v.nameIndex = done; v.handleKey(KEYMAP.ENTER);
assert.equal(v.settingsPage, 'inputs');
assert.equal(JSON.parse(store.alvidaa_custom_names)['1'], 'XY');
v.handleKey(KEYMAP.BACK); // inputs -> root
assert.equal(v.settingsPage, 'root');
v.handleKey(KEYMAP.BACK); // root closes
assert.equal(v.settings, false);

// Idle: arm, enter, and any key wakes without activating.
v.prefs.idleMinutes = 1;
v.armIdle();
v.enterIdle();
assert.equal(v.idle, true);
const n = calls.length;
v.handleKey(KEYMAP.ENTER);
assert.equal(v.idle, false);
assert.equal(calls.length, n, 'wake key must not activate');

// Render every layer through a fake h and sanity-check the tree.
const styleSink = [];
const tagSink = [];
function fakeH(tag, data, children) {
  tagSink.push(String(tag));
  if (data && data.style) {
    for (var fk in data.style) styleSink.push(String(data.style[fk]));
  }
  const node = { tag, style: data && data.style };
  node.count = 1 + (Array.isArray(children) ? children.reduce((a, c) => a + (c && c.count ? c.count : 0), 0) : 0);
  return node;
}
v.prefs.idleMinutes = 0; v.cancelIdle();
v.fav = 0;
const home = opts.render.call(v, fakeH);
assert.ok(home.count > 150, 'home renders pixel type blocks, got ' + home.count);
v.page = 'inputs';
assert.ok(opts.render.call(v, fakeH).count > 120);
v.page = 'home';
v.overlay = true;
const drawerNode = opts.render.call(v, fakeH);
assert.ok(drawerNode.count > 250, 'drawer renders its own full scene, got ' + drawerNode.count);
// The page under a full-screen flat ground is NOT painted: the
// drawer scene must be cheaper than the home page it replaces,
// every marquee beat (review, 2026-11-22).
assert.ok(drawerNode.count < home.count,
  'page under the drawer ground must not be rendered: ' +
  drawerNode.count + ' vs home ' + home.count);
v.overlay = false;
v.openLauncherSettings();
assert.ok(opts.render.call(v, fakeH).count > 60);
v.settingsPage = 'name'; v.nameDraft = 'AB';
assert.ok(opts.render.call(v, fakeH).count > 200, 'keyboard renders 40 cells');
v.closeSettings();
v.idle = true; v.idleFade = 1;
const idleNode = opts.render.call(v, fakeH);
assert.ok(idleNode.count > 100, 'idle clock renders big, got ' + idleNode.count);
v.idle = false;

// Video-plane probe branch (4K wallpaper experiment, 2026-11-22): when the
// build injects the probe global, renderAll must swap the WHOLE page for
// one video element over a transparent root — the point of the probe is
// that nothing else paints over the plane.
sandbox.AlvidaaProbeVideo = 1;
sandbox.AlvidaaProbeSrc = "file:///var/local/alvidaa/wallpapers/probe/wp.mp4";
tagSink.length = 0;
const probeNode = opts.render.call(v, fakeH);
assert.ok(tagSink.indexOf("video") >= 0, 'probe render must include a video element');
// Root + one video + the VIDPROBE label's pixel glyphs and nothing else:
// the point is that no page chrome (tiles, rail, foot) rides over the
// plane. The pixel font alone costs ~83 blocks for 8 letters, so the
// ceiling is set just above the label, still far below a full page.
assert.ok(probeNode.count < 110,
  'probe page must be label-and-video only, got ' + probeNode.count);
delete sandbox.AlvidaaProbeVideo;
delete sandbox.AlvidaaProbeSrc;

// Scale: 3840-wide stage must double every coordinate, rounded.
v.width = 3840;
const scaled = opts.render.call(v, fakeH);
assert.ok(scaled.style.width === '100%');
v.width = 1920;

// Marquee: names longer than the lane (kit.LABEL_W chars at u4)
// scroll only while the ring rests on them. The heartbeat guard is
// a pure string check and stays asleep when the focused name fits;
// clamp restamps the phase only when the ring actually moves.
assert.equal(kitK.LABEL_W, 9, 'nine chars fill the 257 tile lane at u4');
v.idle = false; v.page = 'home'; v.railOpen = true; v.edit = false;
v.prefs.favorites = ['netflix', 'browser'];
v.fav = 0; v.clamp();
assert.equal(v.scrollActive(), false, 'short favorite names fit the lane');
v.prefs.favorites = ['yt', 'netflix'];  // "YouTube: Watch" is 14 chars
v.fav = 0; v.clamp();
assert.equal(v.scrollActive(), true, 'long favorite name scrolls under the ring');
// The settling beat belongs to the RING, not the scroll: a name
// that FITS the lane still opens from its word, so the guard must
// stay awake near the beat end, then sleep. "Prime Max" is 9 —
// exactly the lane, two words, so nothing scrolls.
var netApp = null; for (var ai = 0; ai < v.apps.length; ai++) { if (String(v.apps[ai].appId) === 'netflix') netApp = v.apps[ai]; }
if (!netApp) throw new Error('netflix app missing from test fixture');
netApp.appName = 'Prime Max';
v.prefs.favorites = ['netflix', 'yt'];
v.fav = 0;                               // no stamp: the clock derives itself
assert.equal(v.scrollActive(), true, 'beat running: opening frame pending');
v._phase.t0 -= 5000;                     // beat long over
assert.equal(v.scrollActive(), false, 'settled full name: guard sleeps');
const homeScroll = opts.render.call(v, fakeH);
assert.ok(homeScroll.count > 100, 'marquee frame renders, got ' + homeScroll.count);
v.enterInputs();
v.railOpen = true;
assert.equal(v.scrollActive(), false, 'ports lane focus: HDMI1 fits the lane');
v.prefs.customNames = { '7': 'NETFLIX CASTING APP' };
v.inputRow = 0; v.inputDataSel = 0; v.clamp();
assert.equal(v.scrollActive(), true, 'renamed data tile overflows: guard wakes');
v.prefs.customNames = {};
v.clamp();
assert.equal(v.scrollActive(), false, 'plain TV name: guard sleeps again');
// Phase discipline WITHOUT stamps: the clock follows the selection
// identity, render and guard share one clock, and lid travel restarts
// it — reopening never catches a scroll mid-name.
v.inputRow = 1; v.inputSel = 0;
var kA = kitK.selKey(v);
kitK.phaseMs(v); var tA = v._phase.t0;
kitK.phaseMs(v);
assert.equal(v._phase.key, kA, 'held ring: same clock');
assert.equal(v._phase.t0, tA, 'held ring: phase untouched');
v.inputSel = 1;
assert.notEqual(kitK.selKey(v), kA, 'ring move retargets the phase key');
kitK.phaseMs(v);
assert.equal(v._phase.key, kitK.selKey(v), 'new ring position takes the new clock');
var kB = kitK.selKey(v);
v.railOpen = true; v.closeLid();
assert.equal(v.railOpen, false, 'closeLid drops the lid');
v.openLid();
assert.equal(v.railOpen, true, 'openLid lifts the lid');
assert.notEqual(kitK.selKey(v), kB, 'lid travel retargets the clock');
assert.ok(kitK.phaseMs(v) < 50, 'reopened: clock starts fresh at zero');

// Zen mode (owner, 2026-11-22): 5 s after the lid collapses, the
// chrome fades to clock + date on bare wallpaper; any key restores
// everything and lifts the lid.
assert.equal(kitK.ZEN_MS, 5000, 'chrome fades five seconds after collapse');
v.page = 'home';
v.openLid(); v.closeLid();
assert.ok(v.zenAt > 0, 'collapse arms the zen countdown');
v.zenTick(Date.now());
assert.equal(v.zen, false, 'no zen before the five seconds');
v.zenTick(Date.now() + 6000);
assert.equal(v.zen, true, 'chrome gone past the five seconds');
v.zen = false;
var sinkA = styleSink.length;
opts.render.call(v, fakeH);
v.zen = true;
var sinkC = styleSink.length;
opts.render.call(v, fakeH);
function anyStyle(from, sub) {
  for (var i = from; i < styleSink.length; i++) {
    if (styleSink[i].indexOf(sub) >= 0) return true;
  }
  return false;
}
assert.ok(anyStyle(sinkC, "rgba(0,0,0,0.75)"), 'halo glyphs back the zen clock');
assert.ok(!anyStyle(sinkC, "rgba(0,0,0,0.6)"), 'no header scrim in zen');
assert.ok(!anyStyle(sinkC, "rgba(0,0,0,0.85)"), 'no super band in zen');
assert.ok(anyStyle(sinkA, "rgba(0,0,0,0.85)"), 'bands live before zen fades');
assert.equal(v.handleKey(kitK.keys.UP), true, 'any key wakes zen');
assert.equal(v.zen, false, 'wake restores chrome');
assert.equal(v.railOpen, true, 'wake also lifts the lid');
v.railOpen = true; v.openLid(); v.closeLid(); v.edit = true;
v.zenTick(Date.now() + 9000);
assert.equal(v.zen, false, 'an edit session never fades to zen');
v.edit = false;

// YELLOW is a two-way switch for apps mode (owner, 2026-11-22).
v.overlay = false;
v.handleKey(KEYMAP.YELLOW);
assert.equal(v.overlay, true, 'YELLOW opens apps mode');
assert.equal(v.handleKey(KEYMAP.YELLOW), true, 'YELLOW is claimed inside apps mode');
assert.equal(v.overlay, false, 'YELLOW exits apps mode');

// GREEN = the vendor's TV sheet, BLUE = this launcher's settings,
// bound on home and on inputs (owner, 2026-11-22).
v.page = 'home';
v.handleKey(KEYMAP.GREEN);
assert.deepEqual(calls[calls.length - 1], ['stock-settings'], 'green opens TV settings');
v.handleKey(KEYMAP.BLUE);
assert.equal(v.settings, true, 'blue opens the launcher settings page');
v.handleKey(KEYMAP.BACK);
assert.equal(v.settings, false, 'back closes the settings root');
v.page = 'inputs';
v.handleKey(KEYMAP.GREEN);
assert.deepEqual(calls[calls.length - 1], ['stock-settings'], 'green works on inputs too');
v.handleKey(KEYMAP.BLUE);
assert.equal(v.settings, true, 'blue works on inputs too');
v.handleKey(KEYMAP.BACK);
assert.equal(v.settings, false);
v.page = 'home';

// --- settings panel wraps its content (owner, 2026-11-22) -----------
// A short list is a short box: no blank band under the last row. And
// Favorites is a report row, not a page — pins live on the rail, where
// RED edits and OK removes; the APPS page pins back.
v.handleKey(KEYMAP.BLUE);
assert.equal(v.settings, true, 'blue opens launcher settings');
assert.equal(v.settingsPage, 'root');
const sRows = v.settingsRows();
assert.ok(!sRows.some(r => /fav/i.test(r.kind) || /fav/i.test(String(r.label))),
  'no favorites row in settings at all');
const sMark = styleSink.length;
opts.render.call(v, fakeH);
const wantH = (140 + Math.min(sRows.length, 9) * 76 + 40) + 'px';
assert.ok(styleSink.slice(sMark).includes(wantH), 'box height wraps its rows: ' + wantH);
assert.ok(!styleSink.slice(sMark).includes('height:900px'), 'no full-height box for a short list');
v.handleKey(KEYMAP.BACK);
assert.equal(v.settings, false, 'back closes the wrapped panel');
v.page = 'home';

// --- edit mode moves pins (reorder lives on the rail) ---------------
v.edit = true; v.railOpen = true; v.page = 'home'; v.fav = 1;
v.prefs.favorites = ['netflix', 'browser'];
assert.equal(v.handleKey(KEYMAP.UP), true, 'UP reorders while editing');
assert.deepEqual(v.prefs.favorites, ['browser', 'netflix'], 'UP swaps the pin with its neighbour');
assert.equal(v.fav, 0, 'selection follows the moved app');
assert.equal(v.handleKey(KEYMAP.DOWN), true);
assert.deepEqual(v.prefs.favorites, ['netflix', 'browser'], 'DOWN swaps back');
assert.equal(v.fav, 1);
v.handleKey(KEYMAP.DOWN); // at the end: no wrap, and no lid close mid-edit
assert.deepEqual(v.prefs.favorites, ['netflix', 'browser'], 'no-op at the rail end');
assert.equal(v.railOpen, true, 'the lid stays open while editing');
v.handleKey(KEYMAP.ENTER); // OK removes the selected pin
assert.deepEqual(v.prefs.favorites, ['netflix'], 'OK still removes in edit mode');
v.edit = false;

// --- the grid edit: RED = edit, OK toggles the pin, one view only ---
v.prefs.favorites = ['netflix'];
v.page = 'home';
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.overlayEdit, false, 'a fresh open starts calm');
assert.equal(v.overlaySpans(), null, 'one view: no pin sections over the grid');
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.overlayEdit, true, 'RED edits the grid like the rail');
assert.equal(v.overlayIndex, 0, 'entering an edit never moves the focus');
const gList = v.overlayList();
let netflixAt = -1;
for (let gi = 0; gi < gList.length; gi++) {
  if (String(gList[gi].appId) === 'netflix') { netflixAt = gi; break; }
}
assert.ok(netflixAt >= 0, 'netflix sits in the single flat grid');
v.overlayIndex = netflixAt;
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.deepEqual(v.prefs.favorites, [], 'OK in edit unpins the focused app');
assert.equal(v.overlay, true, 'pinning never closes the grid');
assert.equal(v.overlayIndex, netflixAt, 'the toggle never moves the focus');
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.deepEqual(v.prefs.favorites, ['netflix'], 'OK pins it back, in the same seat');
assert.equal(v.pinSlot(v.overlayList()[netflixAt]), 1, 'the tile wears its rail slot');
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.overlayEdit, false, 'RED exits the edit');
assert.equal(v.handleKey(KEYMAP.ENTER), true);
assert.equal(v.overlay, false, 'outside edit, OK launches instead');
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.handleKey(KEYMAP.RED), true);
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.overlay, false, 'YELLOW closes from an edit too');
assert.equal(v.handleKey(KEYMAP.YELLOW), true);
assert.equal(v.overlayEdit, false, 'closing resets the edit');
v.handleKey(KEYMAP.BACK);
assert.equal(v.overlay, false, 'BACK closes the grid');

// --- settings no longer pins: one door per decision -----------------
v.settings = true; v.settingsPage = 'apps'; v.settingsIndex = 0;
const setRows = v.settingsRows();
let appRowAt = -1;
for (let si = 0; si < setRows.length; si++) {
  if (setRows[si].kind === 'app') { appRowAt = si; break; }
}
assert.ok(appRowAt >= 0, 'the apps page lists apps');
const favsBefore = v.prefs.favorites.slice();
v.settingsIndex = appRowAt;
v.handleKey(KEYMAP.LEFT);
assert.deepEqual(v.prefs.favorites, favsBefore, 'LEFT in settings no longer pins');
const hid = String(setRows[appRowAt].app.appId);
v.handleKey(KEYMAP.ENTER); // hide the app
assert.ok((v.prefs.hiddenApps || []).some(a => String(a) === hid), 'OK hides');
v.settingsIndex = appRowAt;
v.handleKey(KEYMAP.ENTER); // show it again
assert.ok(!(v.prefs.hiddenApps || []).some(a => String(a) === hid), 'OK shows again');
v.settings = false; v.settingsPage = 'root';

console.log('PASS: native/ modules boot, navigate, persist, and render');
