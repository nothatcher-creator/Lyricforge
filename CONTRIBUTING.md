# Contributing to LyricForge

LyricForge is a dependency-light browser application. Use **Node 20+**. A normal clone should run without a build step or package install.

## Setup and tests

```bash
npm run dev
npm test
npm run test:browser
```

For behavior changes, use **TDD**: add a focused failing test, verify the failure, implement the smallest change, then rerun the focused and full suites. UI changes must include Chrome/browser regression coverage and should check both desktop and Android-style **portrait** layouts. Do not remove mobile reachability to make a desktop feature easier.

## Code changes

Keep domain logic out of `src/app.mjs` where practical. Pure editor operations belong in focused modules under `src/editor/`; portable preset parsing/storage/catalog behavior belongs under `src/presets/`. Existing projects must remain backward-compatible.

Before a pull request, run `npm test` and `npm run test:browser`. Explain any skipped test and do not claim browser coverage that did not run.

## Preset contributions

Preset files are data-only. Read `docs/preset-format.md` and `docs/presets.md`, add the `.lyricpreset` file under `presets/library/`, update `presets/catalog.json`, then run:

```bash
node --test tests/preset-schema.test.mjs tests/preset-library.test.mjs tests/preset-catalog.test.mjs
```

Do not include third-party font binaries, copyrighted audio/video/images, scripts, HTML, credentials, or API keys in preset files.
