# Editor Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add professional canvas and timeline editing tools with shared selection/history semantics, touch-friendly portrait access, and preview/export parity.

**Architecture:** Add focused editor helper modules for selection, transforms, and timeline operations. `src/app.mjs` owns UI orchestration only; model helpers produce immutable/clone-safe project changes and the renderer/audio engine consume normalized crop/fade/transform fields.

**Tech Stack:** Browser ES modules, Canvas 2D, Pointer/Touch Events, Web Audio, IndexedDB project model, Node built-in tests, Chrome 153 browser tests.

**Spec:** `docs/superpowers/specs/2026-09-12-downloadable-presets-editor-tools-design.md`

## Global Constraints

- One completed drag/resize/rotate gesture creates one undo history entry.
- Desktop tools must have a reachable portrait-mobile equivalent.
- Locked clips/tracks/objects reject mutation.
- Existing v0.3.6 pinch behavior remains: selected object scales; empty preview zooms workspace.
- Preview and WebM export must agree for crop, opacity/fades, transforms, and effects.
- Existing project documents load with defaults for all new optional fields.

---

### Task 1: Normalize new editor model fields

**Files:**
- Modify: `src/core/model.mjs`
- Create: `tests/editor-model.test.mjs`

**Interfaces:**
- Produces normalized clip fields: `crop:{left,top,right,bottom}`, `fadeInUs`, `fadeOutUs`, `label`, `groupId`, and transform flip flags `flipX`, `flipY`.
- Produces workspace fields: `canvasSnap`, `canvasZoom`, `timelineTool`, `trackHeight`.

- [ ] **Step 1: Write failing model normalization tests**

Assert old clips/projects receive safe defaults, crop values clamp to `0..1`, fade durations cannot exceed clip duration, rotation normalization remains stable, and old saved projects remain valid.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/editor-model.test.mjs`
Expected: FAIL because fields/default helpers are missing.

- [ ] **Step 3: Add defaults and normalization helpers**

Keep schema backward-compatible; do not require a destructive migration. Extend `createClip()` defaults and project normalization path used on load/open.

- [ ] **Step 4: Run model/core tests**

Run: `node --test tests/editor-model.test.mjs tests/core.test.mjs tests/bundle.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/model.mjs tests/editor-model.test.mjs
git commit -m "feat: add editor transform crop and fade fields"
```

### Task 2: Canonical selection and object commands

**Files:**
- Create: `src/editor/selection.mjs`
- Create: `tests/editor-selection.test.mjs`

**Interfaces:**
- Produces: `setSelection(ids)`, `toggleSelection(ids,id)`, `groupSelection(project,ids)`, `ungroupSelection(project,ids)`, `duplicateSelection(project,ids)`, `reorderSelection(project,ids,mode)`, `setLocked(project,ids,locked)`, `copyStyle(project,id)`, `pasteStyle(project,ids,styleClipboard)`.

- [ ] **Step 1: Write failing selection/command tests**

Cover additive selection, duplicate id regeneration, group/ungroup, lock rejection, front/back/forward/backward ordering, copy/paste style only across compatible visual types, and unchanged originals after pure helper calls.

- [ ] **Step 2: Run tests**

Run: `node --test tests/editor-selection.test.mjs`
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement pure selection/object helpers**

Return cloned project/results; do not manipulate DOM. Define group ids as generated `group_*` values stored on clips, and preserve relative ordering when moving grouped selections.

- [ ] **Step 4: Run tests**

Run: `node --test tests/editor-selection.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/selection.mjs tests/editor-selection.test.mjs
git commit -m "feat: add canonical editor selection commands"
```

### Task 3: Canvas transform, snapping and crop math

**Files:**
- Create: `src/editor/transforms.mjs`
- Create: `tests/editor-transforms.test.mjs`
- Modify: `src/core/gestures.mjs`

**Interfaces:**
- Produces: `resizeFromHandle(rect,handle,delta,{aspectLocked})`, `rotateFromPointer(center,pointer,start)`, `snapRect(rect,targets,{thresholdPx,viewportScale})`, `flipTransform(transform,axis)`, `normalizeCrop(crop)`, `applyCropDrag(crop,handle,deltaNormalized)`.

- [ ] **Step 1: Write failing transform math tests**

Cover each corner, aspect lock, rotation wrap, flip toggles, center/safe-edge snapping, snap threshold scaled by preview zoom, crop clamping, and no negative-size crop.

- [ ] **Step 2: Run tests**

Run: `node --test tests/editor-transforms.test.mjs`
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement transform math as DOM-free functions**

Use normalized composition coordinates where possible so desktop/mobile share exact behavior. Keep pixel threshold conversion isolated to snapping.

- [ ] **Step 4: Preserve v0.3.6 pinch helper behavior**

Reuse `pinchValue()` for selected-object scale and workspace zoom; add tests proving no regression.

- [ ] **Step 5: Run tests**

Run: `node --test tests/editor-transforms.test.mjs tests/creative-expansion.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/editor/transforms.mjs src/core/gestures.mjs tests/editor-transforms.test.mjs
git commit -m "feat: add canvas transform and crop math"
```

### Task 4: Canvas handles, guides, inspector commands and mobile toolbar

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`
- Modify: `tests/browser-layout.test.mjs`

**Interfaces:**
- Consumes Tasks 1–3.
- Produces visible selection box/handles, rotation handle, alignment guides, selection toolbar, numeric transform fields, crop Apply/Cancel mode, long-press actions.

- [ ] **Step 1: Add failing Chrome tests at desktop and 412×915 portrait**

Assert selected objects expose >=44px-equivalent touch handles in portrait, drag/resize/rotate change project values, alignment guide appears near center, locked objects ignore drag, Undo restores pre-gesture value, crop controls remain above safe-area inset, and long-press opens selection actions.

- [ ] **Step 2: Run focused browser tests**

Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs --test-name-pattern="canvas handles|crop mode|selection toolbar"`
Expected: FAIL.

- [ ] **Step 3: Render selection overlay outside the export canvas**

Use absolutely positioned DOM overlay on `.stage`; guides/handles must never be painted by the composition renderer or appear in export.

- [ ] **Step 4: Wire one-history-entry gestures**

Capture project state on pointerdown/touch start, update live preview during movement, and commit exactly once on pointerup/cancel. Reuse existing state/history APIs rather than pushing on every move.

- [ ] **Step 5: Add inspector/object commands**

Expose X/Y/scale/rotation, flip, duplicate, layer order, group/ungroup, lock, copy/paste style, reset transform, crop mode. Hide incompatible commands rather than leaving dead controls.

- [ ] **Step 6: Run browser tests**

Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs`
Expected: PASS except opt-in external-network Whisper.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/app.mjs tests/browser-layout.test.mjs
git commit -m "feat: add direct canvas editing tools"
```

### Task 5: Timeline operation helpers

**Files:**
- Create: `src/editor/timeline-tools.mjs`
- Create: `tests/timeline-tools.test.mjs`

**Interfaces:**
- Produces: `splitClip(project,clipId,timeUs)`, `trimClip(project,clipId,{startUs,endUs})`, `rippleDelete(project,clipIds)`, `setClipFade(project,clipId,{fadeInUs,fadeOutUs})`, `setClipLabel(project,clipId,label)`, `toggleKeyframeAt(project,clipId,property,timeUs,value)`, `canEditTrack(project,trackId)`.

- [ ] **Step 1: Write failing timeline helper tests**

Cover split source offsets, trims, invalid playhead positions, multi-clip ripple duration, locked track/clip rejection, no accidental audio-master/lyrics shift, fade clamps, duplicate-safe ids, labels, and keyframe add/remove at the same playhead/property.

- [ ] **Step 2: Run tests**

Run: `node --test tests/timeline-tools.test.mjs`
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement pure timeline helpers**

Preserve canonical integer microseconds. Split creates two clips whose visible/source durations match the original. Ripple shift only later editable clips on each affected track by that track's removed contiguous span.

- [ ] **Step 4: Run tests**

Run: `node --test tests/timeline-tools.test.mjs tests/core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/timeline-tools.mjs tests/timeline-tools.test.mjs
git commit -m "feat: add timeline editing operations"
```

### Task 6: Timeline UI, context actions and portrait reachability

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`
- Modify: `tests/browser-layout.test.mjs`
- Modify: `tests/shell.test.mjs`

**Interfaces:**
- Consumes Task 5 helpers.
- Produces Select/Razor tools, trim handles, duplicate, ripple delete, fades, multi-select, labels, track height, snap toggles, keyframe action, desktop context menu and mobile long-press sheet.

- [ ] **Step 1: Add failing shell/browser tests**

Assert Razor split at playhead, trim handles, ripple-delete action, fade controls, label selector, keyframe toggle, track-height control, and all required actions reachable by long-press in portrait.

- [ ] **Step 2: Run focused tests**

Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs --test-name-pattern="timeline tools|razor|ripple|fade"`
Expected: FAIL.

- [ ] **Step 3: Implement tool mode and desktop/mobile actions**

Store `workspace.timelineTool` as `select` or `razor`. Razor clicking a clip splits at the clicked canonical time. Long-press opens a bottom context sheet in portrait; desktop uses contextmenu plus toolbar shortcuts.

- [ ] **Step 4: Keep timeline scrolling/zooming intact**

Pointer/touch handlers must not steal two-finger pinch zoom or vertical/horizontal scroll outside active handles.

- [ ] **Step 5: Run browser tests**

Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs`
Expected: PASS except opt-in live Whisper.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css src/app.mjs tests/browser-layout.test.mjs tests/shell.test.mjs
git commit -m "feat: add timeline editing toolbar and actions"
```

### Task 7: Crop/fade/transform preview-export parity

**Files:**
- Modify: `src/render/renderer.mjs`
- Modify: `src/audio/engine.mjs`
- Modify: `src/export/video-export.mjs`
- Modify: `tests/render-export.test.mjs`

**Interfaces:**
- Consumes normalized model fields from Task 1.
- Ensures same transform/crop/visual fade math in preview/export and same audio fade envelope in playback/export path where audio clips are supported.

- [ ] **Step 1: Add failing renderer/export tests**

Test crop source/destination rectangles, flip transform, fade opacity at start/middle/end, and a rendered frame hash/pixel assertion showing preview/export helper paths use the same values.

- [ ] **Step 2: Run tests**

Run: `node --test tests/render-export.test.mjs`
Expected: FAIL for unsupported fields.

- [ ] **Step 3: Implement shared render math**

Apply crop before transform draw, apply flip around clip center, multiply opacity by fade envelope, and keep selection overlays entirely outside renderer.

- [ ] **Step 4: Implement audio fade envelope where applicable**

Use canonical clip-relative microseconds to compute gain. Do not add audio-master time-stretch or pitch correction.

- [ ] **Step 5: Run render/export tests**

Run: `node --test tests/render-export.test.mjs tests/audio-transcription.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/render/renderer.mjs src/audio/engine.mjs src/export/video-export.mjs tests/render-export.test.mjs
git commit -m "feat: render crop transforms and fades consistently"
```

### Task 8: End-to-end editor regression and release wiring

**Files:**
- Modify: `tests/workflow.test.mjs`
- Modify: `tests/browser-layout.test.mjs`
- Modify: `sw.js`
- Modify: `package.json`
- Modify after repository plan: `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Validates all editor tasks as one saved/reopened/exported workflow.

- [ ] **Step 1: Add end-to-end workflow test**

Create media clip → resize/rotate/crop → group with another object → split/trim → set visual fade → add keyframe → save/reopen → undo/redo relevant edits → export short WebM. Assert no selection guides/handles appear in exported composition.

- [ ] **Step 2: Run full suite from working tree**

Run: `node --test tests/*.test.mjs`
Run: `CHROME_BIN=/path/to/chrome npm run test:browser`
Expected: zero failures; only explicitly opt-in external model test may skip.

- [ ] **Step 3: Bump release/cache version to `0.3.7` only after green tests**

Update `package.json` and `sw.js` together and ensure all new `src/editor/` and `src/presets/` modules plus preset catalog assets required for first load are handled by the deploy/service-worker policy.

- [ ] **Step 4: Package and verify fresh extraction**

Create `LyricForge-v0.3.7.zip`, extract to a clean directory, rerun Node + Chrome suites from that extraction, and record SHA-256 of the ZIP and critical runtime files before Pages deployment.

- [ ] **Step 5: Commit**

```bash
git add tests/workflow.test.mjs tests/browser-layout.test.mjs package.json sw.js
git commit -m "release: verify LyricForge v0.3.7 editor tools"
```
