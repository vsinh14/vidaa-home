#!/usr/bin/env node
'use strict';
// Build the alvidaa native Home candidate: private stock bundle + our parts.
//
// The stock bundle is vendor code and never enters the repo, so the expected
// sha256 is a required argument. A build that cannot state which revision it
// targets is a build that cannot be rolled back safely.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { hash } = require('./native-trial.cjs');
const wallpaper = require('./wallpaper.cjs');
// The frontend lives in native/ as one module per concern, concatenated
// in numeric order onto a shared namespace (00-kit bootstraps it; the
// bundle boundary is where modularity ends and the single-file contract
// for the TV begins — the WebView gets one script, the repo gets ten).
const PARTS = [
  'native-platform.js',
  'native/00-kit.js',
  'native/10-glyphs.js',
  'native/20-model.js',
  'native/30-lifecycle.js',
  'native/32-settings.js',
  'native/34-keys.js',
  'native/40-paint.js',
  'native/50-pages.js',
  'native/60-layers.js',
  'native/80-component.js',
  'native-entry.js'
];
const MARKER = 'ALVIDAA_NATIVE_HOME_V1';

// Production pass for our parts: the vendor half of the bundle is already
// the vendor's minified production build (Vue production too — verified by
// the absence of the Vue dev-mode banner in the stock bundle), but ours is
// readable source with comments, which the TV pays to download and parse
// at every boot. Minify when a local esbuild can be found; never fail the
// build over it — an unminified candidate is still correct, just heavier.
function localEsbuild() {
  try { return require('esbuild'); } catch (e) { /* not a repo dep */ }
  try {
    return require(require.resolve('esbuild', {
      paths: ['/home/lawliet/Documents/programs/deepseek-harness/node_modules/.pnpm']
    }));
  } catch (e) { return null; }
}

function build(stockFile, output, expect, options) {
  assert.match(String(expect || ''), /^[0-9a-f]{64}$/,
    'expected sha256 of the stock bundle is required');
  const stock = fs.readFileSync(stockFile);
  assert.equal(hash(stock), expect, 'stock bundle does not match the pinned revision');
  // The wallpaper is generated here and inlined, so the candidate stays one
  // self-contained file and the repo carries no image asset.
  let art = 'self.AlvidaaNativeWallpaper="data:image/png;base64,' +
    wallpaper.render().toString('base64') + '";';
  const inputArt = options && options.inputArt;
  if (inputArt && typeof inputArt === 'object' && Object.keys(inputArt).length > 0) {
    art += '\nself.AlvidaaNativeInputArt=' + JSON.stringify(inputArt) + ';';
  }
  // The device silhouettes (issue #60) travel as rules + icons, not as a map of
  // this TV's inputs: the build does not know which ports exist, and it must
  // not have to. The component applies the rules to the name the TV reports.
  const deviceArt = options && options.deviceArt;
  if (deviceArt && typeof deviceArt === 'object' && deviceArt.icons) {
    art += '\nself.AlvidaaNativeDeviceArt=' + JSON.stringify(deviceArt) + ';';
  }
  // Per-app tint (issue #56): dominant colours extracted host-side from the
  // allowlisted icons (app-colours.cjs), keyed by icon basename. Absent when
  // the pipeline had no icons, and the component keeps the plain wash.
  const appColours = options && options.appColours;
  if (appColours && typeof appColours === 'object' && Object.keys(appColours).length > 0) {
    art += '\nself.AlvidaaNativeAppColours=' + JSON.stringify(appColours) + ';';
  }
  // Each part is already a closed IIFE, so minified parts concatenate with
  // the same '\n;\n' joins as the sources; mangled locals cannot collide
  // across parts because none leak out of their closure.
  const esbuild = localEsbuild();
  const parts = PARTS.map(file => {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return esbuild ? esbuild.transformSync(source,
      { minify: true, target: 'es2017', legalComments: 'none' }).code : source;
  });
  const candidate = '/* ' + MARKER + '\n * variant: native/ modules (page frame)\n */\n' + art + '\n' +
    stock + '\n;\n' + parts.join('\n;\n');
  new vm.Script(candidate, { filename: 'native-candidate.js' });
  if (output) {
    const target = path.resolve(output);
    const privateRoot = path.resolve(__dirname, '../../firmware') + path.sep;
    assert.ok(target.startsWith(privateRoot) || target.startsWith('/tmp/'),
      'vendor-containing output must stay private');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, candidate, { mode: 0o600 });
    fs.chmodSync(target, 0o600);
  }
  return candidate;
}

if (require.main === module) {
  const [stock, output, expect] = process.argv.slice(2);
  assert.ok(stock && output && expect,
    'Usage: build-native-alvidaa.cjs private-stock.js private-output.js <expected-sha256>');
  const candidate = build(stock, output, expect);
  console.log('Built alvidaa native candidate' +
    (localEsbuild() ? ' (parts minified)' : ' (parts unminified: esbuild unavailable)') +
    ': ' + Buffer.byteLength(candidate) + ' bytes; sha256 ' + hash(candidate));
}
module.exports = { build, PARTS, MARKER };
