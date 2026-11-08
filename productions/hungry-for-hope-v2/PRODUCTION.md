# Hungry For Hope V2 — production notes

#WEED_SMOK · September 22, 2024

Separate full-song revision. Original V1 audio, 53 cues, 213 words and timestamps are preserved. 1920 × 1080, 24 FPS, H.264/AAC. V1 remains available separately.

| Approved upgrade | Implemented result |
| --- | --- |
| Multiple living environments | Six new environment angles plus reused coast, cathedral and aperture plates; three transparent foregrounds; animated clouds, rain, water bands and dust |
| Artist scenes | Three generated photographic scenes using the inspected composite of both supplied artist references: storm close-up, ruined-hall silhouette and warm aperture portrait |
| Escalating choruses | Four hook levels increase typography scale, camera travel, image exposure and light intensity |
| Connected transitions | Cloud dissolves, arch sweeps and generated foreground occlusion across 28 shots |
| Environmental lyrics | Selected wall-perspective projection, wet-floor reflection and fog-space treatment |
| Focus pulls | Independent near/far blur over the first 1.1 seconds of selected shots |
| Music lighting | Stored bass energy controls broad glow; measured impacts control light sweeps and edge illumination; section energy controls rays |
| Monochrome middle | Color drains at 87.59 seconds and returns with the full hook at 115.43 seconds |
| Generated titles | Two separate transparent generated title assets, visually checked for exact wording |
| Cinematic finish | Shared grade, soft bloom, deterministic animated grain, fast-transition trails and deliberate opening/closing fades |

Fourteen new generated assets and four reused V1 assets. The asset manifest records dimensions, hashes and alpha checks. These are generated stills animated in Remotion, with procedural effects; no generated performance footage is claimed.

The existing word timings are acoustic estimates. The user declined another timing-refinement pass for V2. Uncertain words remain marked in the editable project and QC report; this release does not claim manually verified word-perfect alignment.

## Reproduce

Install Node dependencies with `npm ci`, install FFmpeg and Chromium, and restore the original MP3 to `public/media/hungry-for-hope.mp3` (not redistributed separately). Start `npm run dev`; open `hungry-for-hope-v2.json` in the studio.

Run `npm run build`, `npm test`, `node tests/hope-v2-layout.mjs`, then `npx tsx server/render-hope-v2.ts final`. Render progress is printed as JSON. `python3 server/qc-hope-v2.py` verifies the actual delivered MP4 and writes a contact sheet and verification report. `python3 server/package-hope-v2.py` builds the reusable source archive.

Final-file verification and GitHub delivery are recorded in the accompanying verification JSON and delivery README. Core composition runs locally without subscriptions or external API keys. The source archive includes licensed fonts and image assets.
