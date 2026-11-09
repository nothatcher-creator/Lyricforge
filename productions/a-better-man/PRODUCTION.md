# A Better Man — production notes

#WEED_SMOK · June 11, 2025 · Fragments / Becoming Whole

Full 304.88-second source; 1920 × 1080 at 24 FPS, 7,318 frames. The user approved a silver/blue/burgundy fractured-mirror film, a restrained bridge and a warm human resolution. All 361 supplied tokens across 67 phrases are retained, including spelling and profanity.

The film has 42 directed shots, 18 newly generated delivery assets, four major spaces, multiple reference-based artist portraits and six escalating refrain levels. Images include wide views, material details and separate transparent foregrounds. Mirrors and glass form independent perspective layers. Barlow Condensed Black supplies forceful declarations; Cormorant Garamond makes the bridge quieter. Bass energy drives broad light/scale movement; measured transients drive restrained type accents and edge glints. The long instrumental passage develops imagery without invented lyrics. Matching generated silver titles open and resolve the film.

The artist scenes are generated photographic interpretations of the supplied reference images; no singing-performance footage is claimed. Fatherhood scenes show anonymous symbolic characters and do not claim a real child/family identity. The reference board, source-generation mapping, hashes, dimensions and transparency checks are preserved in project files. OFL font notices are included.

## Timing and review

Local Whisper supplied independent vocal anchors; local CTC aligns only supplied words inside constrained phrase windows. The final repeated call uses the first exact ordered speech sequence, with raw CTC values retained in word metadata. A display hold covers the backing call. Raw confidence, independent anchor agreement, discrepancies and review flags remain editable. Low CTC confidence is retained even when strong independent timing agreement supports a word.

The initial whispered supplied phrase was not independently recovered by Whisper and stays flagged. Additional non-supplied ad-libs/backing repeats are not invented as primary lyric lines. The project does not claim manually verified word-perfect timing. `alignment-review.json` records the same vocal boundaries as `aligned-lines.json`; project cue entrances lead by up to 0.1 second and hold briefly for readability.

## Render and reuse

The default software Canvas compositor consolidates images, reflective planes, light, particles and grain into one surface. Typography stays in the shared React composition. The original DOM compositor remains available through `film.renderer: "dom"`; the default is `"canvas"`. Six representative frame pairs were visually inspected, with mean channel differences below 4/255. Cache keys include source, media, fonts, renderer and encoding settings.

Extract both `A-Better-Man-studio-source.zip` and `A-Better-Man-assets.zip` into the same directory (both contain the `lyric-studio/` root). The split keeps each file within GitHub’s limit. Then restore the original MP3 to `public/media/a-better-man.mp3`, run `npm ci`, install FFmpeg/Chromium and start `npm run dev`. Open `a-better-man.json` in the visual studio. Lyrics, timing, artist credit, intensity and project data remain editable; Codex can change shot/scene/type fields directly in the JSON and composition.

`npx tsx server/render-better-master.ts` renders native CRF18 video chunks with source/audio/asset hashes. It reuses complete matching chunks after interruption, joins video without frame duplication and encodes the continuous original audio once. `python3 server/finish-better-man.py` validates the master, keeps it, and creates a GitHub-sized viewing copy only if the native master exceeds 99 MiB. The viewing copy uses H.264 at the original resolution and frame rate, with copied AAC audio. No subscription/API key is needed to re-render existing assets.

Run `npm run build`, `npm test`, `node tests/better-man-layout.mjs`, and `python3 server/qc-better-man.py`. Final-file checks validate actual frame count, dimensions, codecs, full decode, audio start alignment and peak, plus a representative contact sheet. Source/layout checks do not substitute for those actual-file checks.

Previous productions and V2 files are preserved. This production is delivered in a separate GitHub folder and branch.
