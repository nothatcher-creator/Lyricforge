# Rendering and separate-server deployment

The browser uses `@remotion/player`; the Node API renders the **same React composition** (`src/video/index.ts`, composition `LyricForge`) with Remotion's renderer and its bundled FFmpeg pipeline. No screen recording or browser-specific animation is used. Every animation derives from the frame number; analysis arrays are serialized with the project, so preview and export share the same timing.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api`, `/uploads` and `/renders` to the Node server on port 3002. For the standalone Remotion Studio, use `npm run studio` and open the printed port 3001 URL.

On Linux install Chromium and the required system libraries. The renderer automatically uses `/usr/bin/chromium` when present; set `CHROMIUM_PATH` for a different executable. If absent, Remotion can download its supported browser. FFmpeg is used by Remotion for encoding and muxing; install the system `ffmpeg` command for independent verification and media tools.

## Production / Android browsers

```sh
npm run build
npm start
```

The Node API serves `dist`, uploads and completed renders. Browse port 3002 from any modern browser, including Android. Chromium rendering runs on the server; the phone only edits and previews. Put a reverse proxy with HTTPS in front of Node for remote use. `API_PORT` changes the server port. `CORS_ORIGIN` allows one separate frontend origin if using a separately hosted client; proxy `/api`, `/uploads`, and `/renders` to this API or configure the client's API base accordingly. Preserve relative media paths in saved project JSON.

This starter is a single-user local studio. Before exposing it on the public internet, add authentication, per-user access checks, quotas, durable job storage and media cleanup. Jobs are in memory and queued serially with a maximum of four pending jobs. A server restart loses job status but leaves MP4 files on disk. Uploaded and rendered files persist in `public/uploads` and `public/renders` until removed. Do not run development `tsx watch` as a production process manager.

## API

- `GET /api/health`: rendering and optional alignment capability.
- `POST /api/upload`, multipart field `file`: upload MP3/WAV, PNG/JPG/WebP, MP4/WebM, or WOFF/WOFF2/TTF/OTF, max 250 MiB. Returns `{url,name,type,size}`.
- `POST /api/render`: JSON `{project,resolution}` with resolution `720p`, `1080p` or `4k`. Returns a job with `id`, `status`, `progress` (0–100).
- `GET /api/render/:id`: poll the job; on completion use its `url` to download MP4. Failed jobs include `error`.
- `DELETE /api/render/:id`: cancels a queued or active job.
- `GET /api/alignment/status`: reports local/external availability and supported language.
- `POST /api/alignment-jobs`: JSON `{audioUrl,words,duration,language:"en"}` starts a queued job. `GET` or `DELETE /api/alignment-jobs/:id` polls/cancels it. In-flight progress is indeterminate; completed jobs include validated words.
- `POST /api/align`: compatibility synchronous endpoint with the same fields. Uses the managed local CPU service after `npm run setup:alignment`, or an optional `ALIGNMENT_URL` provider. See `alignment.md`.

Resolution options are 1280×720, 1920×1080 and 3840×2160. Vertical projects swap the dimensions. All renders use 30 fps, H.264 video, AAC audio and MP4. 4K needs substantially more memory/time. Duration is capped at 30 minutes, 20,000 lyric words and 500 scenes per job. Set `RENDER_CONCURRENCY` to control frame-render parallelism (default 2).

Only known local uploads and bundled samples may be rendered. This prevents arbitrary remote or filesystem URLs from being fetched by render workers. The API validates times, dimensions, analysis and style ranges; unsupported or missing media returns an actionable error. Custom fonts uploaded in the Typography panel are stored as `style.customFontUrl`; the composition loads them with a dedicated `@font-face` for both Player preview and server export. Only uploaded WOFF, WOFF2, TTF or OTF URLs are accepted by the render API. Ensure your license permits embedding any font you upload.

## Verify an MP4

```sh
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate -show_entries format=duration -of json public/renders/JOB_ID.mp4
```

An MP4 must contain both H.264 video and AAC audio, have the chosen dimensions and a duration matching the composition. To inspect a specific lyric boundary, extract frames immediately before and after its start time:

```sh
ffmpeg -ss 1.0 -i public/renders/JOB_ID.mp4 -frames:v 1 /tmp/lyric-boundary.png
```

## Verified MVP export (2026-11-07)

The initial import/timed-lyrics composition was rendered through `POST /api/render` before advanced effects were added. Smoke job `305102e5-ffbc-492b-ae6c-9d4e8b1659f5` produced `public/renders/305102e5-ffbc-492b-ae6c-9d4e8b1659f5.mp4`: 1280×720 H.264 at 30 fps, AAC audio, 2.005 seconds for a requested two-second composition. A decoded frame at 1.2 seconds was visually checked and showed the expected active word “RISE” highlighted, matching its 0.9–1.8 second timing in the test fixture. This uses the original generated instrumental and manually authored demonstration text; it does not claim vocal synchronization or an automatic transcription result.

## Final browser verification (2026-11-07)

The final serial Playwright suite passed **9/9 tests** in 1.6 minutes. It exercised actual WAV/MP3 and enhanced-LRC/SRT/TXT imports, precise word corrections, timeline scrubbing and playback, scene splitting, preset undo/redo, custom template saving, browser autosave/reload, reversed lyric/audio file selection, and mobile editing at 390 px. It also confirmed that closing and reopening the export dialog retains an active render job.

The browser downloaded and `ffprobe` independently verified these real exports:

| Artifact                           | Video                    | Audio | Duration |
| ---------------------------------- | ------------------------ | ----- | -------- |
| `artifacts/ui-export.mp4`          | H.264, 1280×720, 30 fps  | AAC   | 2.005 s  |
| `artifacts/ui-export-1080p.mp4`    | H.264, 1920×1080, 30 fps | AAC   | 1.003 s  |
| `artifacts/ui-export-vertical.mp4` | H.264, 720×1280, 30 fps  | AAC   | 1.003 s  |

The first export combines the synthwave atmosphere, Bounce typography, an uploaded WOFF2 font and a generated MP4 background. A decoded frame at 1.2 seconds visibly highlights “motion,” matching the authored 1.0–2.0 second word cue. These are generated audio/timing fixtures; they do not test a live vocal-alignment service. Full probe data is saved in `artifacts/export-verification.json`.

All ten styles and eight animation presets produced distinct browser frames. Repeated screenshots of each animation and seek-away/seek-back screenshots of a fixed frame matched exactly. Desktop/mobile screenshots are `artifacts/editor-desktop.png` and `artifacts/editor-mobile.png`; the HTML test report is `artifacts/playwright-report/index.html`. 4K dimensions and accepted resolution settings are unit-tested, but a 4K MP4 was not rendered in this verification.

Vite ignores generated uploads and renders in its file watcher to prevent development reloads from disrupting editing or export state. This is development watcher hardening; production serving does not use Vite.

## Automatic alignment integration verification

After adding managed CPU alignment, 18 Node/API tests, eight Python tests (including real model inference), and all 16 browser tests passed. The opt-in real alignment browser test uploaded original synthetic speech with accompaniment, received nine measured word cues, and exported `artifacts/real-alignment/aligned-vocals.mp4` as H.264 1280×720 with AAC audio, duration 2.581 seconds. Model timings were carried unchanged into the shared Remotion composition. See [alignment setup and limits](alignment.md).
