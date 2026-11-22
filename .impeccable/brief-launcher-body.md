# Surface brief — native home launcher (P100)

Scope: TV home screen + inputs page, Operate mode, fixed 1920×1080 panel, remote only (arrows, digits, colour keys, OK, back). Visitor: household at a glance from 3 m, mostly evening/dim room.

## Direction contract

THESIS: The home is a teletext index page — your own numbered line-up of channels (apps), not the category-default poster wall of app tiles. The page is a P100 frame: indices, numbers, and a wallpaper window, the way Ceefax thought in numbers.

OWN-WORLD: True-black ground with an empty wallpaper band mid-page. Candy chrome: white 90px block clock, cyan P100 label, amber P110 cue, green LIVE dot. Rail tiles painted in each app's own brand colour — no cubes, no launcher pigment on the rail; page numbers top-right, one-word names bottom-left, 4px white outline marks selection. Flat fills, hard outlines, mono micro-lines; no gradients, no glow.

STORY: Walk in, read the time and the line-up of six numbered favourites; arrow or type a digit (page-number jump) to select, OK launches; INPUTS live on their own page, cued in amber at the foot. The rail outlives any app: favourites grow past six without rebranding.

FIRST VIEWPORT: one screen, no fold (1920×1080). Top-left: block clock, date micro-line under it. Top-right: P100 index label, live-input micro line under it. Middle band deliberately empty (wallpaper). Floor rail near the bottom: six brand-painted tiles, numbers/names per OWN-WORLD. Short foot under the rail: RED/GREEN/YELLOW key chips with EDIT/LAUNCH/APPS words left, "P110 INPUTS ▸" right. Signature interactions: digit-key jump to a page number, left/right page-slide between P100 and P110.

FORM: page-frame teletext home, owner-pinned through refinement rounds (frame chosen over grid/rows/mosaic; candy theme chosen; brand-blocks identity rule chosen). seed: none (pinned) — "I want to puruse page 100", "design grammer looks good just turning specifics around this page now", "Candy pop but add how would the competing idenitfy systems issue be resolved".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions

- On-TVF teletext type: VT323/Space Mono unavailable on the panel (no @font-face) — clock glyphs drawn as block divs or system mono rendition, decided in build and proven on screenshot.
- Wallpaper band: user-selectable background-image lane (later phase; band stays empty-black for now).
