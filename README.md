# LyricForge

A browser lyric video studio built with React, TypeScript, Remotion, Meyda, and a Node render API. Edit word timings over a measured waveform, preview frame-driven animation, and export an H.264/AAC MP4 from the same composition.

## Install and run

Requirements: Node.js 22+, npm, and a Chromium-compatible Linux/macOS/Windows render host. FFmpeg is required for the media verification scripts. The render server uses `/usr/bin/chromium` if available; otherwise set `CHROMIUM_PATH` or install Remotion's supported browser with `npx remotion browser ensure`.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The render API runs on port **3002**. The repository includes the official Remotion agent skills in `.agents/skills/remotion-best-practices`, installed with:

```sh
npx skills add remotion-dev/skills --skill remotion-best-practices --yes --agent codex
```

Preview the registered composition in Remotion Studio separately:

```sh
npm run studio
# http://localhost:3001/LyricForge
```

For a production build served by Node:

```sh
npm run build
npm start
# http://localhost:3002
```

## Create a video

1. Choose **Audio → Import your song** to upload MP3/WAV. Analysis measures waveform peaks, intensity, bass, transient candidates, and a tempo estimate when the signal supports one.
2. Choose **Lyrics → Import or paste lyrics**. Import TXT, LRC, enhanced LRC, or SRT, or paste your own words. Audio and lyrics can also be selected together.
3. Review timing. Click a word in the lyric panel or timeline, then edit its exact start/end in the inspector. Drag a word to move it; drag its right edge to resize it. Snap can bring edits onto nearby detected beats. Standard LRC/SRT preserve line bounds and estimate intermediate word bounds; TXT timing is an initial estimate, not vocal detection.
4. Enable local automatic alignment once with `npm run setup:alignment`, then restart the app. It starts the CPU processing service automatically. With **Auto-align new lyrics** enabled, importing a song plus TXT or estimated line cues aligns supplied English words to the audio. Exact imported word cues remain untouched. **Align to vocals** runs it on demand. See [alignment setup](docs/alignment.md).
5. Choose a style or drag one onto a scene. Split at the playhead, add scenes, drag scenes to reorder them, rename them, adjust boundaries, and choose verse/chorus/bridge/breakdown behavior. Add custom images/video in Media. Adjust typography, colors, motion, atmospheric intensity, and beat reaction. Custom font files must be licensed for embedding.
6. Click **Export video**, choose 720p, 1080p or 4K, and download the completed MP4. Select 9:16 in Format for vertical output. Rendering runs on the Node host and supports Android clients without rendering on the phone.

**Space** plays/pauses; **←/→** step 0.1 seconds; **Ctrl/⌘ Z** undoes and **Ctrl/⌘ Shift Z** redoes. On smaller screens use **Settings** in the rail to open typography and composition controls. Selecting a word also opens its timing editor below the library.

## Automatic vocal alignment

Install Python 3.10–3.12 and FFmpeg on the processing host, then run:

```sh
npm run setup:alignment
npm run dev
```

The API detects `.venv-alignment` and starts the local service. The first alignment downloads a pinned ~91 MB English ONNX model; subsequent jobs reuse the cache. No GPU, PyTorch, WhisperX, or API key is required. In Lyrics, **Auto-align new lyrics** is enabled by default for new estimated imports. You can opt out, run alignment manually, cancel a job, or keep editing. Newer lyric/timing edits are protected from stale job results. Review measured word confidence and boundaries before exporting.

This is forced alignment of your supplied words, not lyric transcription. The built-in model supports English alphabetic lyrics, clips up to 10 minutes, and bounded transcript/memory limits. Dense backing music, distorted singing and inaccurate text can be rejected rather than producing invented synchronization. Imported timestamps and manual corrections always remain available. For supported multilingual/specialist services, configure `ALIGNMENT_URL`; see [details](docs/alignment.md).

## Projects and templates

Project edits autosave to this browser's local storage (up to 20 projects). Open Projects to switch, create, import JSON, download JSON, or export timed words as SRT. A project JSON references media on the render host; it does not embed the files. Keep that host's `public/uploads` directory with the project. Templates store style settings and the selected preset in this browser and can be applied to another song. Undo history is session-local and retains 50 changes.

The included demo uses an original generated instrumental and original manually authored display lyrics. It has **no recorded vocals** and does not demonstrate automatic vocal alignment. It is meant to make the visual editor immediately usable without third-party music.

## Architecture

- `src/core/types.ts`: serializable project model and Remotion Caption-compatible words.
- `src/core/lyrics.ts`: timestamp import/export, estimation, validation.
- `src/core/analysis.ts`: Web Audio decoding and deterministic Meyda analysis.
- `src/core/presets.ts`: ten reusable genre/style definitions.
- `src/video/`: shared Remotion composition and deterministic atmosphere engine.
- `src/App.tsx`, `src/styles.css`: editor, timeline, import, project management, inspector, and export UI.
- `server/alignment.ts`, `alignmentRuntime.ts`, `alignmentJobs.ts`: service detection/lifecycle, strict supplied-word matching, queued jobs and cancellation.
- `scripts/ctc_alignment.py`, `align_service.py`: pinned CPU ONNX inference, CTC Viterbi alignment, confidence checks and local HTTP processing.
- `src/core/useAlignment.ts`: automatic imports, background status and protection for newer edits.
- `server/render.ts`, `server/index.ts`: media storage, bounded serial render queue, progress/cancellation, H.264 encoding, API and static serving.

There is no animation clock, unseeded randomness, or CSS animation in the exported video. Visual state is a function of frame, project, and serialized audio analysis. Player previews scale the composition to the available viewport; exports use the chosen full resolution.

## Test

```sh
npm test                 # parser, analysis, alignment, render/API validation
npm run build            # strict TypeScript and production browser bundle
npm run dev              # keep running in another terminal
npm run test:e2e         # actual browser import/edit/preview/export + alignment integration
npm run test:alignment   # Python CTC tests after setup:alignment
# ALIGNMENT_SMOKE=1 npm run test:alignment  # real model inference
```

Browser tests use `/usr/bin/chromium` by default and use original FFmpeg-generated audio fixtures. See `playwright.config.ts` for configuration. Artifacts include desktop/mobile screenshots and a real two-second MP4. To independently check an export:

```sh
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate -show_entries format=duration -of json artifacts/ui-export.mp4
```

See [rendering and deployment](docs/rendering.md), [timing and optional alignment](docs/alignment.md), and [licenses](docs/licenses.md).

## Deployment scope

This is a working single-user studio. Rendering requires a Node host that can run Chromium/FFmpeg; a static-only host cannot export MP4s. For a separate frontend set `VITE_API_URL` at build time and `CORS_ORIGIN` on the API, or reverse-proxy media and API paths. Local alignment uses a separately installed CPU runtime (`npm run setup:alignment`), automatically started by the API; an external provider remains optional. 4K output is implemented but needs sufficient server resources; browser-verified exports include 720p, 1080p and vertical 720p. A full 4K export was not rendered in this verification.

Before a multi-user internet deployment, add authentication, per-user media access, durable jobs, storage quotas and cleanup. Jobs currently live in memory; media files persist on disk. The current procedural engine simulates depth, particles, camera drift, fog and distortion in 2D; it is not a physical 3D renderer. Beat/tempo estimates and forced alignment should always be reviewed for complex music.
