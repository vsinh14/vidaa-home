---
version: 2
slug: "tools-launcher-host-native"
primary_target: "tools/launcher-host/native/"
related_targets: ["tools/launcher-host/build-native-alvidaa.cjs", "tools/launcher-host/test-native-modules.cjs"]
---

# Surface brief — native home launcher (P100)

Scope: TV home screen (P100) + inputs page (P110), overlay, settings, idle — remote only (arrows, digits, colour keys, OK, back). Visitor: household at a glance from 3 m, mostly evening/dim room. Panel is 4K 85" but the launcher WebView lays out at 1920; the UI scales from `innerWidth` and draws chrome type as integer-pixel blocks so the 2× upscale cannot make it look soft.

## Direction contract

THESIS: The home is a teletext index page — your own numbered line-up of channels (apps), not the category-default poster wall of app tiles. The page is a P100 frame: indices, numbers, and a wallpaper window, the way Ceefax thought in numbers.

OWN-WORLD: True-black ground with an empty wallpaper band mid-page. Candy chrome: white 90px block clock, cyan P100 label, amber P110 cue, green LIVE dot. Rail tiles painted in each app's own brand colour — no cubes, no launcher pigment on the rail; page numbers top-right, one-word names bottom-left, 4px white outline marks selection (red in edit mode). Flat fills, hard outlines, mono micro-lines; no gradients, no glow.

STORY: Walk in, read the time and the line-up of six numbered favourites per block (up to 18 across three blocks, digit keys 1–9/0 jump-launch 101–110); arrow past the rail end or press DOWN for P110 INPUTS, BACK returns. RED edits the rail, GREEN launches, YELLOW opens the apps grid, MENU opens stock TV settings.

FIRST VIEWPORT: one screen, no fold (1920×1080 stage). Top-left: block clock (5×7 pixel face, u13), date micro-line under it. Top-right: P100 index label in cyan, live-input micro line under it with the signal dot. Middle band deliberately empty (wallpaper). Floor rail: six brand-painted blocks 208×144, letter/number/name per OWN-WORLD. Short foot under the rail: RED/GREEN/YELLOW chips with EDIT/LAUNCH/APPS words left, "P110 INPUTS >" amber right. Signature interactions: digit-key jump to a page number, page-slide P100↔P110, idle clock layer fading over the wallpaper.

FORM: page-frame teletext home, owner-pinned through refinement rounds (frame chosen over grid/rows/mosaic; candy theme chosen; brand-blocks identity rule chosen). seed: none (pinned) — "I want to puruse page 100", "design grammer looks good just turning specifics around this page now", "Candy pop but add how would the competing idenitfy systems issue be resolved".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Implementation facts (2026-11-22, live on panel)

- Source is modular: `native/00-kit.js` (geometry/palette/helpers), `10-glyphs` (5×7 pixel face), `20-model`, `30-lifecycle`, `32-settings`, `34-keys`, `40-paint`, `50-pages`, `60-layers`, `80-component`; the build minifies each part (esbuild, best-effort) and concatenates onto the pinned vendor bundle. Headless harness proves boot/keys/persistence/render, raw and minified.
- Teletext type is settled: 5×7 GLYPHS drawn as run-merged div blocks, integer device px — proven on device 2026-11-22 (screenshot `shots/p100-modular-1.png`: OCR misreads the block face as expected, every element's pixel box matches its layout constant).

## Unresolved decisions

- Wallpaper band: user-selectable background-image lane (later phase; band stays the build-time generated art for now).
- Raw colour-key codes 182/183/184 as fallback alongside named RED/GREEN/YELLOW: named mapping live on panel, raw fallback unverified by bridge injection.
