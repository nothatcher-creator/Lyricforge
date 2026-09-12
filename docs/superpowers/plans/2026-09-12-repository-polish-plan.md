# Repository Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `nothatcher-creator/Lyricforge` into a useful public repository with accurate setup/docs, contribution templates, security guidance, and a first-party downloadable preset catalog.

**Architecture:** Documentation and GitHub metadata live at repository root/`.github`, while preset catalog files live under `presets/` and are validated with Node tests against the v0.3.7 preset schema. No license or unsupported public claims are added automatically.

**Tech Stack:** Markdown, GitHub issue forms, static JSON/`.lyricpreset`, Node built-in tests, GitHub Pages static deployment.

**Spec:** `docs/superpowers/specs/2026-09-12-repository-polish-design.md`

## Global Constraints

- Do not create a `LICENSE` file without an explicit owner license choice.
- Do not publish secrets, personal contact details, private endpoints, or fake CI badges.
- README/browser/version claims must match tested v0.3.7 behavior.
- Preset docs/catalog examples must match the implemented schema exactly.
- Screenshot links are added only for image assets committed to the repository.

---

### Task 1: Current public README

**Files:**
- Create or replace: `README.md`
- Test: `tests/repository-docs.test.mjs`

**Interfaces:**
- Documents live demo, current version, quick start, tests, features, privacy, mobile support, project structure, preset ecosystem, roadmap and contribution links.

- [ ] **Step 1: Write failing repository-doc tests**

Test that README contains the GitHub Pages URL, `npm run dev`, Node `>=20`, `npm run test:browser`, local-first privacy wording, Auto Transcribe local/remote distinction, portrait support, preset-library section, links to CONTRIBUTING/SECURITY/preset docs, and no broken `LICENSE` link.

- [ ] **Step 2: Run test**

Run: `node --test tests/repository-docs.test.mjs`
Expected: FAIL because repository README/docs are absent or stale.

- [ ] **Step 3: Write the README from verified project facts**

Use `https://nothatcher-creator.github.io/Lyricforge/` as live demo. State that runtime is dependency-free, local development requires serving over HTTP, Node 20+ is supported, built-in Whisper runs locally after model download, and remote transcription is optional/consent-based. Describe v0.3.7 tools only after implementation tests pass.

- [ ] **Step 4: Run docs test**

Run: `node --test tests/repository-docs.test.mjs`
Expected: README assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md tests/repository-docs.test.mjs
git commit -m "docs: add complete LyricForge README"
```

### Task 2: Contribution and security guidance

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Modify: `tests/repository-docs.test.mjs`

**Interfaces:**
- CONTRIBUTING describes code/preset contribution workflow.
- SECURITY provides non-secret disclosure guidance without inventing private contact information.

- [ ] **Step 1: Add failing docs assertions**

Require CONTRIBUTING to mention Node 20+, `npm test`, Chrome browser tests for UI changes, portrait regression expectations, TDD for behavior changes, and preset validation. Require SECURITY to warn against posting secrets and to reference GitHub private vulnerability reporting conditionally rather than promise an email/SLA.

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test tests/repository-docs.test.mjs`
Expected: FAIL because files are missing.

- [ ] **Step 3: Write both documents**

Include exact commands from `package.json`; explain no `npm install` is needed for the dependency-free runtime/test setup unless future dependencies are added. Preset contributors must use data-only files and pass catalog/schema validation.

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/repository-docs.test.mjs`
Expected: PASS.

```bash
git add CONTRIBUTING.md SECURITY.md tests/repository-docs.test.mjs
git commit -m "docs: add contribution and security guides"
```

### Task 3: GitHub issue and pull-request templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `tests/repository-docs.test.mjs`

**Interfaces:**
- GitHub forms collect actionable reproduction/feature information.

- [ ] **Step 1: Add failing file-content assertions**

Bug form must request LyricForge version, browser, OS/device, orientation, GitHub Pages/local build, steps, expected/actual, console error. Feature form must request problem, desired workflow, mobile impact and alternatives. PR template must require tests and note any mobile/preset/schema impact.

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test tests/repository-docs.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Add valid GitHub YAML/forms and PR template**

Set blank issues enabled so security reporters can request a private contact route without exposing details. Do not add unsupported external contact links.

- [ ] **Step 4: Run test and commit**

Run: `node --test tests/repository-docs.test.mjs`
Expected: PASS.

```bash
git add .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md tests/repository-docs.test.mjs
git commit -m "docs: add GitHub contribution templates"
```

### Task 4: Preset authoring and catalog documentation

**Files:**
- Create: `docs/presets.md`
- Create: `docs/preset-format.md`
- Modify: `tests/repository-docs.test.mjs`

**Interfaces:**
- Must mirror `src/presets/schema.mjs` and `src/presets/library.mjs` from the downloadable-presets plan.

- [ ] **Step 1: Add failing schema-doc consistency tests**

Import schema constants/allowed values and assert docs contain the actual signature `lyricforge-preset`, schema version, size limit, catalog signature, security restrictions, font-reference rule, effect/background fields and contribution validation command.

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test tests/repository-docs.test.mjs`
Expected: FAIL because docs are missing.

- [ ] **Step 3: Write `docs/preset-format.md`**

Include a complete minimal JSON example that passes `validatePresetRecord()`, field table, compatibility/version rules, duplicate/install behavior, forbidden embedded binaries/scripts, and extension/MIME guidance.

- [ ] **Step 4: Write `docs/presets.md`**

Explain creating a preset in LyricForge, exporting `.lyricpreset`, local import testing, adding it to `presets/library/`, adding a catalog entry, running validation, and submitting a PR.

- [ ] **Step 5: Run test and commit**

Run: `node --test tests/repository-docs.test.mjs`
Expected: PASS.

```bash
git add docs/presets.md docs/preset-format.md tests/repository-docs.test.mjs
git commit -m "docs: document lyricpreset authoring and format"
```

### Task 5: First-party preset catalog and automated validation

**Files:**
- Create: `presets/catalog.json`
- Create: at least 8 entries under `presets/library/*.lyricpreset`
- Create: `tests/preset-catalog.test.mjs`
- Modify: `.github/workflows/pages.yml` if deployment does not already copy `presets/`

**Interfaces:**
- Catalog consumed by `src/presets/library.mjs` default `./presets/catalog.json` URL.

- [ ] **Step 1: Write failing catalog validation tests**

Load every catalog entry, resolve its local file, validate with `validatePresetRecord()`, assert unique ids, matching id/name/version metadata, HTTPS or relative asset URLs, no missing files, and catalog categories/tags are strings within schema limits.

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test tests/preset-catalog.test.mjs`
Expected: FAIL because catalog/files are missing.

- [ ] **Step 3: Create initial catalog from original factory configurations**

Use at least these original/config-only presets as downloadable samples: `Cyberpunk`, `Phonk`, `Vintage Film`, `Metalcore`, `Dreamy`, `Minimal Karaoke`, `Western`, `Documentary`. Do not embed font binaries, images, audio or video.

- [ ] **Step 4: Ensure GitHub Pages publishes the catalog**

If the Pages workflow builds a staging `_site`, copy `presets/` into `_site/presets/` and add an integrity check that `presets/catalog.json` exists. Do not alter the runtime reconstruction strategy beyond what is needed to publish these static assets.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/preset-catalog.test.mjs tests/preset-schema.test.mjs tests/preset-library.test.mjs`
Expected: PASS.

```bash
git add presets tests/preset-catalog.test.mjs .github/workflows/pages.yml
git commit -m "feat: publish first-party preset catalog"
```

### Task 6: Changelog, implementation status and release docs hygiene

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `IMPLEMENTATION_STATUS.md`
- Modify: `README.md`
- Modify: `tests/repository-docs.test.mjs`

**Interfaces:**
- Final docs must reflect only tested v0.3.7 functionality.

- [ ] **Step 1: Add failing version-consistency assertions**

Read `package.json`, `sw.js`, README, CHANGELOG and IMPLEMENTATION_STATUS; assert current version is `0.3.7`, one changelog heading exists for each documented release, and no README feature claim uses the old 21/53 preset counts once the downloadable library UI replaces count-centric copy.

- [ ] **Step 2: Normalize changelog ordering and status wording**

Place `v0.3.7` first, then `v0.3.6` downward with one heading each. Move duplicated historical headings into the correct sequence without deleting useful release facts.

- [ ] **Step 3: Update implementation status and README after full product tests pass**

Include downloadable preset library/import/export, direct canvas handles/crop/group/layer commands, timeline split/trim/ripple/fades/keyframes, portrait reachability, and the exact packaged test result from the release verification run.

- [ ] **Step 4: Run repository + full app tests**

Run: `node --test tests/repository-docs.test.mjs tests/preset-catalog.test.mjs`
Run: `node --test tests/*.test.mjs`
Expected: zero failures, excluding only explicitly opt-in external-network tests.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md IMPLEMENTATION_STATUS.md tests/repository-docs.test.mjs
git commit -m "docs: finalize LyricForge v0.3.7 repository"
```
