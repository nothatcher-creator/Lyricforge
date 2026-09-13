# LyricForge

LyricForge is a local-first browser editor for creating lyric videos with synchronized lyrics, layered text/media, genre presets, animation/effects, and timeline editing. The current release line is **v0.3.7**.

Live app: https://nothatcher-creator.github.io/Lyricforge/

## What v0.3.7 includes

- Import audio, video, images, lyric/subtitle files, project fonts, projects, and portable `.lyricpreset` files.
- Auto Transcribe with the built-in local Whisper path after its model is downloaded, plus optional remote-provider support when explicitly configured.
- Manual lyric entry, editing, tap-sync and word timing.
- Factory, Installed, and downloadable **Preset Library** views. Presets can be imported/exported and are validated as data-only JSON.
- Direct canvas move/resize/rotate controls, media crop, flip, grouping, layer order, locking and style copy/paste.
- Timeline Select/Razor tools, split, trim handles, ripple delete, fades, clip labels, track height, snapping and keyframes.
- Preview/export parity for media crop, flips, transforms and visual fades.
- Android-friendly portrait sheets, horizontally reachable toolbars and touch-sized selection controls.
- Local project persistence and portable project bundles. Media stays in the browser unless the user deliberately invokes an existing remote feature.

## Quick start

LyricForge's runtime is dependency-free, but browser module/service-worker behavior requires serving it over HTTP rather than double-clicking `index.html`.

Requirements: **Node 20 or newer**.

```bash
npm run dev
```

Then open the local URL printed by the server.

## Tests

```bash
npm test
npm run test:browser
```

The browser suite launches Chromium/Chrome and checks desktop/mobile editor reachability. Some managed environments block localhost browser navigation; in that case the suite reports an explicit policy skip and CI remains the browser gate.

## Privacy and transcription

LyricForge is local-first. Projects, installed presets, and imported media are stored in browser storage. Built-in Auto Transcribe downloads a Whisper model and processes the song on-device. A remote transcription provider is optional and only used when the user explicitly configures/invokes it.

## Project layout

- `index.html`, `styles.css`, `ui-polish.css` — editor shell and presentation.
- `src/app.mjs` — UI orchestration.
- `src/core/` — project model, history, time, snapping and gestures.
- `src/editor/` — selection, transform and timeline operations.
- `src/presets/` — portable preset schema, installed storage and catalog provider.
- `src/render/` — composition renderer, presets, fonts and effects.
- `src/transcription/` — local/remote transcription providers.
- `src/storage/` — IndexedDB and portable bundle support.
- `presets/` — first-party static catalog and downloadable presets.
- `tests/` — Node and Chrome regression coverage.

## Presets

See [docs/presets.md](docs/presets.md) for authoring/contribution workflow and [docs/preset-format.md](docs/preset-format.md) for the `.lyricpreset` schema/security rules.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for code/preset contributions and [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.

## Roadmap

Future work can build on the v0.3.7 module boundaries for richer timeline operations, community catalogs, preset packs, and more render/export tooling without requiring accounts or cloud storage for the core editor.
