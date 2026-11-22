# ui-lab — 85U7SE native Home UI customization

Baseline: the working native Home UI as deployed 2026-11-20 (contract fixes
for `getAppList`/`getAppInfo` included). Vendor stock bundle stays private.

## Layout

- `tools/launcher-host/native/` — UI sources as one module per concern
  (`00-kit.js` … `80-component.js`); the build concatenates them in numeric
  order into the single-file bundle the WebView requires
- `tools/launcher-host/` — build script, platform adapter, boot hook, and
  `test-native-modules.cjs` (headless boot/keys/persistence/render harness;
  `NATIVE_MIN=1` exercises the minified form the build ships)
- `firmware/` — gitignored working copies: `stock-app.js` (vendor, pinned by
  sha256 `7d57be0a...`) and `candidate-app.js` (the built artifact)

## Workflow (confirm-gated)

1. Edit the UI source(s); `node tools/launcher-host/test-native-modules.cjs`
   must pass (run it with `NATIVE_MIN=1` too when the build minifies)
2. `node tools/launcher-host/build-native-alvidaa.cjs firmware/stock-app.js \
      firmware/candidate-app.js 7d57be0aa0c1728b19cf315dabab905c090548e3f10747c8e2d4e27a5530868d`
3. Deploy: rollback engine → push candidate (base64) → install → restart engine
4. Screenshot; user confirms on the TV
5. Only then: `git commit` — one confirmed change per commit
