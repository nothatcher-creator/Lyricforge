# Downloadable Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, local-first `.lyricpreset` format plus import/export, installed-preset persistence, and an in-app downloadable preset catalog.

**Architecture:** Keep factory presets in `src/render/presets.mjs`, add isolated preset schema/storage/library modules, and let `src/app.mjs` compose factory + installed + remote catalog views. Projects store resolved style/effect values when a preset is applied; downloaded preset records live separately in IndexedDB.

**Tech Stack:** Browser ES modules, IndexedDB, Fetch API, native File/Blob APIs, Node built-in test runner, Chrome 153 browser regression suite.

**Spec:** `docs/superpowers/specs/2026-09-12-downloadable-presets-editor-tools-design.md`

## Global Constraints

- `.lyricpreset` is UTF-8, versioned, data-only JSON; never evaluate downloaded content.
- Remote preset/catalog URLs are HTTPS-only outside localhost development.
- Factory presets stay immutable; installed/downloaded presets are stored separately.
- Existing v0.3.6 preset/font/effect behavior must not regress.
- Applying a preset to a project is undoable; installing/removing a library item is not project history.
- Existing projects must load without migration failure.

---

### Task 1: Versioned `.lyricpreset` schema and serializer

**Files:**
- Create: `src/presets/schema.mjs`
- Create: `tests/preset-schema.test.mjs`
- Modify: `src/render/presets.mjs`

**Interfaces:**
- Produces: `PRESET_SIGNATURE`, `PRESET_SCHEMA_VERSION`, `normalizePresetRecord(input)`, `validatePresetRecord(input,{maxBytes})`, `factoryPresetToRecord(preset)`, `serializePreset(record)`.
- Consumes later: storage, catalog downloads, import/export UI.

- [ ] **Step 1: Write failing schema/round-trip tests**

Cover a valid factory preset round-trip, unknown-key stripping, invalid signature, unsupported schema, non-object values, executable-looking markup fields, invalid numeric ranges, and a preset that references a known web-font id without embedding font bytes.

```js
const record=factoryPresetToRecord(PRESETS[0]);
const text=serializePreset(record);
assert.deepEqual(normalizePresetRecord(JSON.parse(text)),record);
assert.throws(()=>validatePresetRecord({signature:'not-lyricforge'}),/preset file/i);
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `node --test tests/preset-schema.test.mjs`
Expected: FAIL because `src/presets/schema.mjs` does not exist.

- [ ] **Step 3: Implement the schema module**

Use signature `lyricforge-preset`, schema version `1`, max serialized size `262144` bytes, explicit allowlists for top-level/style/background/visualizer/video-effect fields, string length caps, and numeric clamps matching the existing renderer/model ranges. `serializePreset()` returns pretty-printed JSON ending in `\n`.

- [ ] **Step 4: Export factory preset records without changing factory application behavior**

Add an adapter in `src/render/presets.mjs` only where necessary so every factory preset can be represented by the schema while `applyPreset()` continues to resolve the same visual values.

- [ ] **Step 5: Run tests**

Run: `node --test tests/preset-schema.test.mjs tests/creative-expansion.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presets/schema.mjs src/render/presets.mjs tests/preset-schema.test.mjs
git commit -m "feat: add portable lyricpreset schema"
```

### Task 2: Installed preset persistence

**Files:**
- Create: `src/presets/storage.mjs`
- Modify: `src/storage/db.mjs`
- Create: `tests/preset-storage.test.mjs`

**Interfaces:**
- Produces: `listInstalledPresets()`, `getInstalledPreset(id)`, `installPreset(record,{replace})`, `removeInstalledPreset(id)`, `isPresetInstalled(id,version)`.
- Requires: `normalizePresetRecord()` from Task 1.

- [ ] **Step 1: Write failing persistence tests**

Use fake IndexedDB hooks already used by storage tests or a minimal in-memory fallback abstraction. Test install/list/get/remove, duplicate id rejection, compatible replacement, generated local id for incompatible collision, and persistence independent of projects.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/preset-storage.test.mjs`
Expected: FAIL because storage functions are missing.

- [ ] **Step 3: Upgrade IndexedDB safely**

Increment `DB_VERSION` from `1` to `2` and create a `presets` object store with `keyPath:'id'` in `onupgradeneeded`, preserving existing `projects` and `assets` stores.

- [ ] **Step 4: Implement `src/presets/storage.mjs`**

Store normalized records plus install metadata `{installedAt,source,sourceUrl}`. Use `localStorage` JSON fallback only when IndexedDB is unavailable; never mix preset records into project documents.

- [ ] **Step 5: Run storage + existing DB/bundle tests**

Run: `node --test tests/preset-storage.test.mjs tests/bundle.test.mjs tests/core.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/db.mjs src/presets/storage.mjs tests/preset-storage.test.mjs
git commit -m "feat: persist installed presets"
```

### Task 3: Static catalog provider and secure downloads

**Files:**
- Create: `src/presets/library.mjs`
- Create: `tests/preset-library.test.mjs`
- Create during repository-polish execution: `presets/catalog.json`, `presets/library/*.lyricpreset`

**Interfaces:**
- Produces: `fetchPresetCatalog(url,{signal,fetchImpl})`, `searchPresetCatalog(entries,{query,category})`, `downloadPreset(entry,{signal,fetchImpl})`.
- Consumes: Task 1 validation and Task 2 install state.

- [ ] **Step 1: Write failing catalog tests**

Test HTTPS acceptance, localhost HTTP acceptance, non-local HTTP rejection, manifest max size `524288` bytes, preset max size `262144` bytes, malformed JSON, entry normalization, search/category filters, and downloaded preset id/version matching catalog metadata.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/preset-library.test.mjs`
Expected: FAIL because library module is missing.

- [ ] **Step 3: Implement catalog fetch/search**

Catalog schema: `{signature:'lyricforge-preset-catalog',schemaVersion:1,updatedAt,entries:[{id,name,author,category,tags,version,minAppVersion,downloadUrl,thumbnailUrl?}]}`. Resolve relative `downloadUrl` against the catalog URL. Treat thumbnails as display-only URLs; never inject them as HTML.

- [ ] **Step 4: Implement preset download validation**

Fetch as text, enforce content-length when present plus actual encoded byte size, parse JSON, run `validatePresetRecord()`, and confirm id/version match the catalog entry before returning the normalized record.

- [ ] **Step 5: Run tests**

Run: `node --test tests/preset-library.test.mjs tests/preset-schema.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presets/library.mjs tests/preset-library.test.mjs
git commit -m "feat: add downloadable preset catalog provider"
```

### Task 4: Import/export and installed/factory/library UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`
- Modify: `src/render/presets.mjs`
- Modify: `tests/browser-layout.test.mjs`
- Modify: `tests/shell.test.mjs`

**Interfaces:**
- Consumes all preset APIs from Tasks 1–3.
- Produces user actions: import `.lyricpreset`, export preset, install/update/uninstall catalog preset, apply installed preset.

- [ ] **Step 1: Add failing shell/browser assertions**

Assert Presets has Factory / Installed / Library modes, Import and Export actions, search/category controls for Library, install/update/remove buttons, and the portrait sheet remains vertically scrollable at 412×915.

- [ ] **Step 2: Run focused browser tests**

Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs --test-name-pattern="preset"`
Expected: FAIL because controls do not exist.

- [ ] **Step 3: Implement import/export commands**

Import reads one file, validates size/schema, renders a confirmation summary, then installs it. Export converts selected factory/installed preset to a schema record and downloads `${safeName}.lyricpreset` via Blob/object URL. Revoke object URLs after click.

- [ ] **Step 4: Implement Library/Installed views**

Use the GitHub Pages-relative default catalog URL `./presets/catalog.json`; show loading/offline/error states without blocking Factory/Installed. Install/update actions persist records then refresh the Installed view. Uninstall requires confirmation but does not mutate projects already using resolved values.

- [ ] **Step 5: Make `applyPreset` accept normalized installed records**

Add `applyPresetRecord(project,record)` and have factory `applyPreset(project,id)` delegate through it. Keep resulting project values equivalent for existing 53 presets.

- [ ] **Step 6: Run browser + creative tests**

Run: `node --test tests/shell.test.mjs tests/creative-expansion.test.mjs`
Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs`
Expected: PASS except the existing opt-in live Whisper case.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/app.mjs src/render/presets.mjs tests/browser-layout.test.mjs tests/shell.test.mjs
git commit -m "feat: add preset library import and export UI"
```

### Task 5: Project reopen, history, offline and end-to-end preset verification

**Files:**
- Modify: `tests/workflow.test.mjs`
- Modify: `tests/browser-layout.test.mjs`
- Modify: `sw.js`
- Modify: `package.json`

**Interfaces:**
- Validates end-to-end behavior across Tasks 1–4.

- [ ] **Step 1: Add failing end-to-end tests**

Cover: install downloaded preset → apply → tweak style → save → reopen → resolved appearance persists; applying preset undo/redo; catalog network failure still leaves Factory/Installed usable; import/export round-trip through browser File/Blob APIs.

- [ ] **Step 2: Run the new tests and confirm failures**

Run: `node --test tests/workflow.test.mjs`
Run: `CHROME_BIN=/path/to/chrome node --test tests/browser-layout.test.mjs --test-name-pattern="preset library|preset import"`
Expected: FAIL until wiring is complete.

- [ ] **Step 3: Add new modules/catalog paths to service-worker caching policy**

Precache same-origin JS modules needed offline. Do not require remote catalog availability during service-worker install; installed presets remain in IndexedDB.

- [ ] **Step 4: Run full preset-related regression suite**

Run: `node --test tests/*.test.mjs`
Expected: zero failures, with only explicitly opt-in external-network tests skipped.

- [ ] **Step 5: Commit**

```bash
git add tests/workflow.test.mjs tests/browser-layout.test.mjs sw.js package.json
git commit -m "test: verify downloadable preset workflows"
```
