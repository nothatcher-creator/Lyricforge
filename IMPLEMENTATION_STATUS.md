# LyricForge Implementation Status

Current target: **v0.3.7**.

Implemented and covered by automated Node tests:

- Portable preset schema, validation, import/export primitives, installed preset persistence, secure catalog fetch/search/download, and first-party **Preset Library** files.
- Backward-compatible editor model defaults for crop, fades, labels, groups, flips, canvas snap/zoom and timeline tool/height.
- Pure selection commands for grouping, duplication, ordering, locking and style copy/paste.
- Canvas transform/crop math plus direct selection handles and inspector commands.
- Timeline split/trim/ripple delete/fade/label/keyframe operations with locked-track/clip rejection in the pure operation layer.
- Renderer crop/flip/visual-fade parity plus audio fade envelope helper.
- Android **portrait** shell reachability, touch-sized handles and mobile timeline/preset surfaces in browser regression tests.
- Save/reopen and undo/redo workflow coverage for applied presets and editor fields.

Fresh-package verification (2026-09-12) reports **52 tests total: 50 passed, 0 failed, 2 skipped**. The only skips are the two Chrome layout cases because Chromium is organization-policy-blocked from localhost in this execution environment. The fresh extraction also passed `tools/build-pages.sh` and verified all eight frozen v0.3.7 release hashes. GitHub CI is the authoritative unrestricted Chrome gate before integration.
