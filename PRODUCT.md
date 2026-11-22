# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(The renderer is the TV's browser engine — Cobalt/Chromium 111 family inside the vendor's Vue 2 home bundle. Fixed 1920×1080 design space, whole UI scaled by `width/1920`. The 85U7SE panel is 4K but the launcher WebView lays out at 1920 (templateInfo evidence), so the 4K pixels arrive by 2× upscaling; the UI answers on two fronts: every dimension scales from `self.innerWidth` so a stage that ever reports 3840 renders natively at S=2, and chrome type is drawn as integer-device-pixel 5×7 glyph blocks that stay hard-edged under doubling. Treated as a 10-foot TV surface, not a responsive website.)

## Users

One person — the TV owner — sitting on the couch across a living room, holding the stock Hisense BT remote (D-pad, OK, Back, digits, colour keys). Nobody else was named as a user. TTS narration and digit shortcuts are extras for this operator, not core to others.

## Product Purpose

Replaces the vendor VIDAA home with a personal home screen built *inside the vendor's own launcher package*: open favorite apps, switch HDMI/inputs, reach the full app list, stock TV settings, and this launcher's own settings — and read the clock. Success = fewer keypresses and less vendor noise than stock, with everything legible from couch distance.

## Positioning

Runs natively inside the vendor home engine (no bridge at runtime, no root at use time): reads the real app list and input list through the vendor SDK and launches through APC, so it is the real home, not an overlay or cast target. All data is local; nothing is fetched except the vendor's own icon host and local files.

## Operating Context

Living room, 85" panel, viewing distance ~3m. Sessions are seconds long: power on → pick a favorite or input → gone. The stock remote is the only input device. Verification happens through on-device screenshots read via OCR (the working agent cannot view TV pixels directly). Deployment is a confirm-gated cycle: build candidate → push → install → engine restart (~1s) → screenshot → owner confirms → git commit, one change per commit. Rollback script is on-device.

## Capabilities and Constraints

- **Favorites are a permanent system** (owner decision 2026-11-22): more than 6, the row grows and scrolls when more are pinned — no hard cap of 6, no layout redesign as the set grows.
- Preserve underneath (owner scoped them out of *removal*, they remain product facts): app launch through APC, source switching through the vendor input service, opening stock TV Settings, the launcher's own settings surface (apps show/hide, favorites editing, input rename with on-screen keyboard, auto-switch on boot, recently-used ordering, idle screen), the full apps overlay, input signal presence (live/no-signal), clock and date, toasts/HUD, TTS of the focused element, digit shortcuts.
- Engine constraints (measured on device): Vue 2 render-function component; absolutely positioned inline styles; no global CSS files; no custom fonts (@font-face does not paint); no SVG data-URI images (they do not paint); app icons via `background-image`, not `<img>`; icons fonts from vendor components don't paint here — device glyphs must be drawn as plain divs; only CSS transitions (300ms class) for motion; preferences persist through `sdk.storage`; wallpaper is a build-time data URI.
- Explicitly replaceable (owner opened them 2026-11-22): the panned three-view layout, the big "hero" focused-name line, the uppercase row labels, the LIVE/STANDBY pills and digit badges, one-word app names, text-only favorite tiles.
- Decided (2026-11-22): arrangement inside Page 100 is the **page frame** (see Brand Commitments); app names stay as short (≤8-char) uppercase captions on the rail; chrome type is drawn as 5×7 pixel-font div blocks since the panel paints no custom fonts.

## Brand Commitments

- **Page 100** — broadcast teletext is the owner-pinned visual world of the home surface (pinned 2026-11-22, after two dealt decision rounds). Grammar kept strict: flat saturated colour blocks on black, page numbers as navigation (favorites numbered 101+; digit keys jump), double-height headline rows, colour-key command line at the foot. Owner conditions: **no HOME banner**; **inputs live on their own page (P110), not on the home screen**; no superfluous status data; **dense scale for the 85" 4K panel** — smaller than typical TV UI (favorites tile ~150×120 and name ~26px in 1920-space; micro labels ~18px). Cube-style letter badges on favorites. Owner refinement (2026-11-22): the **clock-page variant** direction is favoured — time kept **small** (not full-page numerals), favorites **bottom-aligned** as a floor rail, and the **middle of the screen left empty as a wallpaper window** (wallpaper is a build-time data URI). Chosen arrangement (2026-11-22): **page frame** — clock top-left, P100 label top-right, favorites floor rail, colour keys bottom-left, P110 cue bottom-right, nothing between; the foot/key row is **shorter than the favorites rail**. Theme: **Candy pop · Brand blocks** (owner-picked 2026-11-22) — true-black ground, cyan/amber index chrome on white; the app's own brand colour paints its rail tile; no cubes, no launcher-pigment on the rail. One identity system per glance: brand carries the tile, chrome carries the launcher.

No external brand. "Alvidaa"/"alvidaa" are internal code names only and never appear on screen. No vendor branding on the surface. Voice of on-screen text: lowercase, terse, human ("no favorites yet", "press any key to stay").

## Evidence on Hand

Working implementation (rewritten 2026-11-22): `tools/launcher-host/native/` — ten modules (00-kit … 80-component) concatenated by `build-native-alvidaa.cjs` into one candidate bundle; `test-native-modules.cjs` boots the whole tree headlessly (boot, keys, persistence, all render layers) and passes. Built candidate `firmware/candidate-app.js` sha256 `dcf7f70c…` awaits the on-TV confirmation cycle (panel offline). The pre-split monolith `native-alvidaa.js` (2249 lines, md5 `35ec6668…`) is retired from the tree — its proven contract lives in git at baseline e68e2bf and inside the modules. Real device screenshots in `../shots/` (OCR-readable). Real app inventory `../app_list.json`. Vendor contracts source- and hardware-verified (`getAppList{sceneCode:"launcher"}`, `getAppInfo`, `getAllInputsData`, `changeSourceTo`, APC start) documented in the tv-work skill. All on-screen data comes from the vendor SDK — nothing may be fabricated into the UI.

## Product Principles

1. **Fastest path to the usual thing** — favorites land first; focus lands on the live input, not position zero.
2. **Quiet surface, loud content** — chrome (labels, pills, badges) loses to apps and inputs; state is shown by presence, not decoration.
3. **One way to do each thing** — one focus path, one edit path per setting; no competing gestures.
4. **Local and instant** — no network fetches beyond the vendor icon host; motion is cheap CSS on one node.
5. **Grows without redesign** — favorites and inputs can increase; the layout must absorb more items (scroll/window) rather than cap them.

## Accessibility & Inclusion

TTS narration of the focused element via `sdk.tts` is a kept capability (not optional chrome). Roles/tabindex pattern (one `0`, rest `-1`) is kept. Text minimum ~18px at 1920-space, key labels ≥ 22px, sized for 3 m viewing.
