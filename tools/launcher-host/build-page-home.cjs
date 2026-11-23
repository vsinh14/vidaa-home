#!/usr/bin/env node
/* Build the page-lane home bundle.
 *
 * Same module tree as the native candidate (00-kit … 80-component, plus
 * the baked wallpaper art from wallpaper.cjs), but the platform file is
 * the WS page adapter and the entry is the Vue host, so no vendor base
 * and no VRE. Output: page/dist/home.js + page/dist/home.html, ready to
 * drop into /APPS/alvidaa/launcher/home/ on the TV.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const wallpaper = require('./wallpaper.cjs');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'page', 'dist');
const hash = (s) => crypto.createHash('md5').update(s).digest('hex');

const MODULES = [
  'native/00-kit.js', 'native/10-glyphs.js', 'native/20-model.js',
  'native/30-lifecycle.js', 'native/32-settings.js', 'native/34-keys.js',
  'native/36-wallpaper.js',
  'native/37-dvd.js',
  'native/40-paint.js', 'native/50-pages.js', 'native/60-layers.js',
  'native/80-component.js'
];
const PAGE = [
  'page/page-platform.js', 'page/page-sdk.js', 'page/page-host.js'
];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

const parts = [];
parts.push('/* ALVIDAA page-lane home bundle. Build of native/ modules + ' +
  'page adapters. Do not edit dist; edit the tree and rebuild. */');
// Staged boot marker: survives module/host throws so the panel itself
// tells us how far the bundle got. Removed once the lane is stable.
parts.push([
  'try{var b=document.createElement("div");b.id="stage";b.textContent="STAGE0";',
  'b.style.cssText="position:fixed;right:8px;top:50px;z-index:999999;font:28px monospace;color:#ff0;background:#111;padding:2px 6px";',
  'document.body.appendChild(b);self.__stage=function(t){b.textContent=String(t)};',
  'self.addEventListener("error",function(e){self.__stage("THROW "+((e.message||"?").slice(0,60)))});',
  'self.__stage("PRE");}catch(e){}'
].join(''));
// Baked default wallpaper (empty pool = this art).
parts.push('self.AlvidaaNativeWallpaper="data:image/png;base64,' +
  wallpaper.render().toString('base64') + '";');
parts.push(read(path.join('page', 'vendor', 'vue.min.js')));
for (const m of MODULES) parts.push(read(m));
for (const p of PAGE) parts.push(read(p));

const bundle = parts.join('\n;\n') + '\n';
const md5 = hash(bundle);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'home.js'), bundle);
// Cache-bust the bundle URL: the webview caches aggressively per URL, and
// the page itself only reloads on a fresh query, so pin the script to the
// build digest.
const html = read(path.join('page', 'home.html'))
  .replace('/home/home.js', '/home/home.js?v=' + md5);
fs.writeFileSync(path.join(OUT, 'home.html'), html);
console.log('home.js', bundle.length, 'bytes md5', md5);
console.log('home.html md5', hash(html));
