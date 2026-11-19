# ui-lab — 85U7SE native Home UI customization

Baseline: the working native Home UI as deployed 2026-11-20 (contract fixes
for `getAppList`/`getAppInfo` included). Vendor stock bundle stays private.

## Layout

- `tools/launcher-host/` — UI sources (native-alvidaa.js is the renderer)
  plus the build script and its two helper deps
- `firmware/` — gitignored working copies: `stock-app.js` (vendor, pinned by
  sha256 `7d57be0a...`) and `candidate-app.js` (the built artifact)

## Workflow (confirm-gated)

1. Edit the UI source(s)
2. `node tools/launcher-host/build-native-alvidaa.cjs firmware/stock-app.js \
      firmware/candidate-app.js 7d57be0aa0c1728b19cf315dabab905c090548e3f10747c8e2d4e27a5530868d`
3. Deploy: rollback engine → push candidate (base64) → install → restart engine
4. Screenshot; user confirms on the TV
5. Only then: `git commit` — one confirmed change per commit
