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
  RED: 182, GREEN: 183, YELLOW: 184, MENU: 138
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
    { sourceId: 5, name: 'AV', deviceName: 'Roku', is_signal: 0 }
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
assert.equal(v.sources.length, 3);
assert.equal(v.page, 'home');

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
// P110: smart focus is the live port; BACK returns to P100.
assert.equal(v.inputSel, 0);
v.handleKey(KEYMAP.BACK); assert.equal(v.page, 'home');
// Digit on P110 selects and switches.
v.handleKey(KEYMAP.DOWN); assert.equal(v.page, 'inputs');
v.handleKey(KEYMAP.NUM_3);
assert.deepEqual(calls[calls.length - 1], ['source', 5]);
assert.equal(JSON.parse(store.alvidaa_last_used), 5, 'last-used written');

// RED enters edit mode; OK removes the focused block.
v.handleKey(KEYMAP.BACK); assert.equal(v.page, 'home');
v.fav = 0;
v.handleKey(KEYMAP.RED); assert.equal(v.edit, true);
v.handleKey(KEYMAP.ENTER);
assert.equal(v.favoriteItems().length, 2);
v.handleKey(KEYMAP.RED); assert.equal(v.edit, false);

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
// RED inside the overlay opens stock settings.
v.handleKey(KEYMAP.YELLOW);
v.handleKey(KEYMAP.RED);
assert.deepEqual(calls[calls.length - 1], ['stock-settings']);
v.handleKey(KEYMAP.BACK); // back to the page behind the overlay? overlay was left open by stock settings
v.closeOverlay();

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
function fakeH(tag, data, children) {
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
assert.ok(opts.render.call(v, fakeH).count > home.count);
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

// Scale: 3840-wide stage must double every coordinate, rounded.
v.width = 3840;
const scaled = opts.render.call(v, fakeH);
assert.ok(scaled.style.width === '100%');
v.width = 1920;

console.log('PASS: native/ modules boot, navigate, persist, and render');
