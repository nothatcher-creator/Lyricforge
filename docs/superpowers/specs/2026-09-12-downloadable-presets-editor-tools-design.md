# LyricForge v0.3.7 — Downloadable Presets & Editor Tools Design

Date: 2026-09-12
Status: Awaiting written-spec review

## Goal

LyricForge v0.3.7 expands the app in two coordinated areas: a shareable/downloadable preset ecosystem and a more capable editing toolset for both the canvas and timeline. The update must preserve the v0.3.6 creative systems, mobile portrait usability, local/offline project model, browser-based rendering/export path, and custom-font support.

The release should feel like a meaningful editor upgrade rather than a collection of disconnected buttons. New tools must share the same selection/history/state model so undo/redo, touch input, desktop input, preview, save/reopen, and export remain consistent.

## Scope

### Preset ecosystem

LyricForge will support both an in-app downloadable preset library and portable preset files that can be imported/exported independently of projects.

Single preset files use the `.lyricpreset` extension. The format is UTF-8 JSON with a versioned schema and a top-level signature field so LyricForge can reject arbitrary unrelated JSON without executing code. Presets are data-only; they may never contain JavaScript, HTML, executable URLs, or inline event handlers.

A preset stores presentation data only:

- stable preset id and schema version
- name, author/display attribution, description and category
- optional thumbnail URL or local preview metadata
- lyric style and active/previous/upcoming states
- font family reference
- entrance, idle and exit text effects
- background style/treatment
- visualizer settings
- whole-video effect settings
- palette/accent metadata
- optional compatibility metadata such as minimum LyricForge version

Preset files must not bundle copyrighted font binaries, arbitrary remote assets, audio, video, project lyrics, project timeline clips, API keys, or transcription configuration. Built-in/downloadable fonts are referenced by LyricForge font id. Imported user fonts remain project assets and are not silently embedded in exported presets.

### Preset import/export

The Presets UI gains Import Preset and Export Preset actions. Export serializes the currently selected built-in/custom/downloaded preset into a `.lyricpreset` file. Import validates schema, size and allowed fields, normalizes missing optional values, shows a preview/summary, and then installs the preset into the user's local preset collection.

Imported/downloaded presets are stored separately from factory presets. Removing them never alters a project that already applied one; projects store the resolved style/effect values after preset application.

Duplicate ids are resolved predictably: an imported preset with the same id prompts replacement only when the incoming schema is compatible; otherwise it is installed under a generated local id while retaining display attribution.

### Online preset library

The Presets tab gains a Library view alongside Installed/Factory presets. The first-party catalog is a static JSON manifest hosted with the project or from a configurable HTTPS catalog endpoint. The manifest lists preset metadata plus a URL to the `.lyricpreset` file.

Library behavior:

- browse by category
- search by name/author/tags
- preview thumbnail and summary
- download/install with one tap
- show installed/update state
- uninstall downloaded presets
- refresh catalog manually
- gracefully fall back to Installed presets when offline

The catalog is treated as untrusted data. Downloads are limited in size, HTTPS-only except localhost development, parsed as text/JSON, validated against the preset schema, and never evaluated.

The initial catalog can live in the LyricForge GitHub Pages deployment so it works without a backend. The catalog URL is isolated behind a small provider module so future community catalogs can be supported without changing preset storage or parsing.

A future `.lyricpack` bundle is intentionally out of scope for v0.3.7; the single-preset schema is designed so packs can simply contain multiple valid `.lyricpreset` records later.

## Canvas editing tools

### Selection model

Canvas editing uses one canonical selection service shared by mouse, touch, inspector and timeline. It supports:

- single select
- additive multi-select
- marquee selection where practical
- group/ungroup
- lock/unlock
- selection bounding box

Selection is UI/workspace state and does not change rendered output by itself.

### Transform handles

Selected visual objects expose touch-friendly transform controls in the preview:

- corner resize handles
- rotation handle
- drag-to-move body
- optional edge handles when aspect lock is disabled

For text/lyric layers, corner scaling changes the style/transform scale rather than destructively rasterizing text. For image/video clips, scaling modifies clip transform. Rotation is normalized to a stable degree range.

Pinch behavior from v0.3.6 remains valid: pinch on a selected editable object scales the selection; pinch on empty preview space zooms the workspace.

### Alignment and snapping

Dragging/resizing displays non-exported alignment guides for:

- composition horizontal/vertical center
- safe-area edges
- composition edges
- other visible unlocked object bounds/centers

Snap targets are enabled by default and can be toggled. The app must avoid sticky/overpowering snapping by using a pixel-distance threshold derived from viewport scale.

### Object commands

The selection toolbar/inspector provides:

- flip horizontal / vertical
- duplicate
- bring forward / send backward
- bring to front / send to back
- group / ungroup
- lock / unlock
- copy style / paste style
- reset transform

Numeric transform fields expose X, Y, scale/width/height where applicable, and rotation. Values update live through the same history-aware state path as direct manipulation.

### Crop

Image/video layers gain a non-destructive crop rectangle stored in clip content/transform metadata. Crop editing happens in an explicit crop mode with Apply/Cancel. Export renderer and preview renderer must use the same crop values.

## Timeline editing tools

The timeline gains a compact tool mode row plus context actions. Desktop may use toolbar/right-click; mobile uses long-press/context sheet and touch-sized buttons.

### Required tools

- Select tool
- Razor/Split tool
- trim handles
- duplicate clip
- ripple delete
- fade in / fade out controls
- multi-select
- clip lock/mute/visibility where applicable
- track lock
- clip color labels
- track height control
- improved snap-source toggles
- add/remove keyframe shortcut at playhead

### Ripple delete

Ripple delete removes selected clip(s) and shifts later clips on the same affected track left by the removed contiguous duration. It never moves locked clips/tracks. Lyrics/audio master are not ripple-shifted unless they are explicitly selected on an editable track, preventing accidental desynchronization of the whole song.

### Fades

Audio/video/image clip fades are stored as non-destructive clip parameters. Audio fades affect gain in playback/export. Visual fades affect opacity in preview/export. Lyrics continue using their existing entrance/exit animation system rather than clip fades unless represented as regular clips.

### Clip speed

Basic playback-rate adjustment is supported for user video clips only in v0.3.7, provided the browser/export path can keep preview and export consistent. Audio-master time stretching and pitch-preserving speed changes are out of scope. If the current renderer cannot safely guarantee video speed parity, the speed control stays hidden rather than shipping as a decorative/nonfunctional tool.

### Slip/slide

Slip/slide editing is deferred unless it can be implemented without introducing a second timeline timing model. v0.3.7 prioritizes reliable split/trim/ripple/fade/keyframe operations first.

## History and undo/redo

Every mutating editor command must produce a coherent undoable history entry. Drag gestures and resize/rotate gestures create one history entry per completed gesture rather than hundreds of entries during pointer movement. Group commands, crop application, timeline split, trim, ripple delete, fades, layer ordering, style paste, and applying a preset to a project all use the same history infrastructure.

Preset catalog browsing, downloading, installing, updating, and uninstalling affect the local preset library rather than project history and are not undoable. Applying an installed preset to a project is undoable.

## Mobile portrait behavior

The v0.3.5/v0.3.6 scrollable bottom-sheet system remains the base mobile shell.

Portrait-specific requirements:

- transform handles use minimum touch targets suitable for Android
- selection toolbar can collapse into a compact floating row
- long-press opens object/timeline context actions
- tool sheets remain vertically scrollable
- bottom navigation remains horizontally scrollable
- Undo/Redo remain directly accessible
- canvas manipulation never blocks two-finger workspace gestures
- crop mode exposes explicit Apply/Cancel controls above Android safe-area/navigation insets

No desktop-only feature may be shipped without an equivalent reachable mobile action unless it is explicitly marked unsupported in the UI.

## Data model changes

The project schema remains backward-compatible. Existing projects load without migration failure. New optional fields are added with defaults during normalization:

- `installedPresetId`/preset provenance metadata where useful
- clip crop metadata
- clip fades
- clip label/color
- optional group id / parent group metadata
- workspace/tool-mode state where persistence is helpful

Downloaded/imported preset records live in IndexedDB in their own store or namespaced record type, not mixed into project blobs. Factory presets remain code-defined and immutable.

The `.lyricpreset` schema is independently versioned from the project schema.

## Module boundaries

New functionality should be isolated rather than growing `src/app.mjs` further.

Recommended modules:

- `src/presets/schema.mjs` — validate/normalize `.lyricpreset`
- `src/presets/library.mjs` — catalog fetch/search/download/install
- `src/presets/storage.mjs` — installed preset persistence
- `src/editor/selection.mjs` — selection/group semantics
- `src/editor/transforms.mjs` — resize/rotate/flip/alignment helpers
- `src/editor/timeline-tools.mjs` — split/trim/ripple/fades/keyframe helpers

The UI shell in `app.mjs` delegates to these modules. Renderer consumes normalized project fields only; it does not fetch remote preset data.

## Error handling

Preset library failures must never prevent local editing. Network errors show a retryable status and leave factory/installed presets usable.

Preset import errors identify the problem in user-readable terms: invalid file, unsupported schema, file too large, missing required fields, or incompatible minimum app version.

Invalid crop/transform/timeline values are clamped by normalization before render/export. Locked objects/tracks reject edits with a lightweight UI indication rather than silently mutating.

## Security and privacy

Preset catalogs and files are untrusted. LyricForge will:

- accept data-only JSON
- reject executable markup/scripts
- use HTTPS-only remote URLs outside local development
- cap manifest and preset download sizes
- validate known keys/types/ranges
- avoid embedding credentials/tokens in catalog URLs
- keep project/media assets local unless an existing user-invoked remote feature explicitly uploads them

## Testing

Implementation is complete only after regression coverage includes:

- `.lyricpreset` export/import round-trip
- invalid/oversized/incompatible preset rejection
- downloadable catalog fetch/install/update/offline fallback
- applying downloaded presets and reopening projects
- undo/redo of apply/edit operations
- transform handle drag/resize/rotate
- pinch selected object vs pinch empty preview
- grouping, ordering, flip, lock and style copy/paste
- alignment/snap thresholds
- crop preview/export parity
- razor/split, trim, ripple delete and locked-track behavior
- fade preview/export parity
- keyframe shortcut behavior
- portrait reachability and touch scrolling
- existing v0.3.6 presets/fonts/effects/transcription/export tests
- WebM render from a project using downloaded preset + crop/fade/transform changes

The release package is verified from a fresh ZIP extraction in Chrome before GitHub Pages deployment. Pages deployment retains byte/hash integrity checks for reconstructed runtime files.

## Release acceptance criteria

v0.3.7 is releasable when:

1. A user can browse, download, install, remove, import and export presets without a backend account.
2. Imported/downloaded presets are data-only, validated and locally persisted.
3. A preset can be applied, edited further, saved, reopened and exported consistently.
4. Core canvas transforms are directly manipulable with touch/mouse and undoable.
5. Split/trim/ripple/fade/keyframe timeline operations function on desktop and are reachable on portrait mobile.
6. Preview and WebM export match for crop, fades, transforms and effects used by the new presets.
7. Existing v0.3.6 mobile scrolling, portrait Undo/Redo, contextual pinch, fonts, effects and Whisper behavior do not regress.
8. Full packaged-build Chrome tests pass with zero failures, excluding only explicitly opt-in external-network model tests.

## Explicitly deferred

The following are not part of v0.3.7:

- user accounts or cloud preset sync
- ratings/comments/community moderation backend
- paid marketplace functionality
- automatic upload of user presets to a public catalog
- `.lyricpack` multi-preset bundles
- bundled third-party font binaries in preset files
- full audio-master time stretching/pitch correction
- advanced NLE slip/slide semantics if they require a second timing model
