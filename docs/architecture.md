# Design and implementation notes

The first milestone was a shared Remotion composition that accepted an uploaded song and serializable words, supported manual edits, and rendered the same cues into an MP4. This was verified at 720p before adding the visual engine. The second milestone added the preset catalog, measured beat/bass/intensity reaction, deterministic particles and typography, scene transitions, responsive editing, fonts, and reusable templates.

A browser-only recorder would be simple to deploy, but its codec availability and animation clock make export reliability device-dependent. Requiring WhisperX inside the main deployment would also break many Android/static frontend setups. LyricForge therefore uses a React/Vite client, a separate long-running Node/Remotion rendering API, and a managed local CPU alignment service with an optional external provider. The included app runs both frontend and API locally, or Node can serve the production build.

The project model carries canonical seconds for scenes, milliseconds for Caption-compatible words, stable media paths, selected preset IDs and section labels, a global typography/motion style, and serialized analysis. Analysis intensity and bass samples have a fixed 50ms interval. Imported/manual timing provenance is preserved per word. No line or word is generated in response to missing lyric content.

Both Player and server rendering use `LyricVideo`. The visual engine samples frame-derived time, uses seeded procedural coordinates, reads the same serialized analysis, and uses a 1920×1080/1080×1920 logical stage scaled to the requested export size. Scene backgrounds overlap during crossfades while lyrics and audio remain single global tracks. Section labels adjust motion/atmosphere gain. This allows 720p/1080p/4K outputs without changing lyric timing.

The frontend stores projects/templates in browser local storage. The render host stores uploaded files and final MP4s. Job metadata is an in-memory bounded queue; no database or shared user tenancy is assumed. Only allowlisted local media paths are passed into render workers. A later production service can replace storage and the job queue without changing the composition or alignment modules.

Current limits: music timing analysis is heuristic; singing alignment needs a configured provider and review; the local CPU CTC model is tested on synthetic speech plus accompaniment, while accuracy on real sung music still requires review; 4K dimensions are tested but a full 4K music-video render was not part of validation. Procedural depth/parallax is 2D. Long exports, multiple users and public internet exposure require operational storage, authentication, quotas and worker management.

## Automatic alignment workflow

The optional isolated Python runtime is installed with `npm run setup:alignment` and is automatically started/recovered by the Node host. A pinned quantized wav2vec2 ONNX model produces 16kHz audio emissions in windows; a real CTC Viterbi path aligns the entire supplied transcript. Confidence gates reject unsupported or unreliable results. No transcription fabricates missing lyric words.

The browser queues estimated imports when automatic alignment is enabled. Queued jobs expose status, indeterminate progress and cancellation. Exact imported word timestamps are preserved unless the user requests realignment. A fingerprint of project/audio/lyric text/timings prevents asynchronous results from overwriting newer user edits. Successful words retain spelling/IDs/line membership and receive measured timestamps/confidence with aligned provenance.
