# Automatic vocal alignment

LyricForge now includes a real CPU forced-alignment service. Supply your original lyrics and audio; the model measures character/word positions in the audio and returns word timestamps. It does **not** generate or substitute lyrics. Automatic alignment can run after importing estimated lyrics, and the Lyrics panel also offers a manual **Align to vocals** action. Every successful word is labeled `aligned`; failed/cancelled jobs keep the previous timings. Cancelling stops the editor job and discards its result; a provider may finish an inference already executing. Exact imported word timestamps are not automatically overwritten, and newer manual edits are protected from stale results.

## Local setup

Requirements: Python 3.10–3.12 on an ONNX Runtime-supported platform, FFmpeg on PATH, and enough memory for audio-model inference. No GPU, PyTorch, Whisper, or WhisperX is required. Python 3.12 on Linux x86-64 is verified.

```sh
npm run setup:alignment
npm run dev
```

`setup:alignment` creates `.venv-alignment` and installs the isolated Python dependencies. Starting the Node server through `npm run dev` or `npm start` detects this environment and starts the local alignment service automatically. If it is not installed or cannot start, the studio remains usable with imported/manual timestamps.

The first alignment downloads the pinned quantized model (about 91 MB) from Hugging Face into the normal Hugging Face cache. Keep that cache between deployments to avoid repeated downloads. Later requests reuse one loaded model process. Allow the initial download to complete; the editor shows job progress/status rather than inventing estimated results and labeling them aligned.

To run the Python service independently:

```sh
npm run alignment:serve
# http://127.0.0.1:8000/health
```

The equivalent explicit command on POSIX systems is:

```sh
.venv-alignment/bin/python -m uvicorn scripts.align_service:app --host 127.0.0.1 --port 8000
```

For an existing Python environment set `ALIGNMENT_PYTHON` to its Python executable. `ALIGNMENT_MODE=off` disables managed local startup. `LOCAL_ALIGNMENT_ORIGIN` changes the local service address (default `http://127.0.0.1:8000`). `ALIGNMENT_TIMEOUT_MS` controls the Node request timeout (default 900,000 ms).

## What the bundled model supports

The local model supports English alphabetic lyrics, including apostrophes and common punctuation. Original spelling, casing, and punctuation remain in the project. Unsupported scripts, numeric tokens, empty words, and unsupported languages fail with an explanation; choose a compatible external service or import timestamps instead. No language is guessed.

The model is `Xenova/wav2vec2-base-960h`, pinned to revision `a19f851b3d42865797e410752b4c570c871e4825`, using `onnx/model_quantized.onnx` and `vocab.json`. It is an ONNX conversion of [`facebook/wav2vec2-base-960h`](https://huggingface.co/facebook/wav2vec2-base-960h), whose upstream model card declares **Apache-2.0**. The ONNX repository identifies the upstream model, but does not declare a separate license in its model-card metadata. Review those upstream terms when redistributing model weights; weights are downloaded separately and are not committed to this repository.

This is a speech-trained CTC model applied to supplied vocal lyrics. Clear, intelligible vocals work best. Distorted metal vocals, overlapping backing vocals, long sustained notes, heavy accompaniment, inaccurate transcripts and vocal effects can reduce reliability. Low-confidence words and low-confidence overall alignments are rejected rather than silently replaced by uniform estimates. A successful confidence check is not proof of perfect singing alignment; review the waveform and every lyric cue before export.

Local limits are 600 seconds, 2,000 whitespace-delimited words, 250 MiB uploads, and a 75-million-cell CTC backtracking budget. Typical shorter songs fit; unusually long/dense songs may need sections or an external service. Inputs that exceed a limit return an actionable error. FFmpeg decoding is bounded and model inference uses 20-second windows with one-second context. Window positions preserve absolute song time; one exact CTC Viterbi path aligns the entire supplied transcript, including blank/repeated-character transitions.

## Offline model deployment

Set `ALIGN_MODEL_DIR` on the alignment process to a directory containing:

```text
model_quantized.onnx
vocab.json
```

The service also accepts the repository-shaped `onnx/model_quantized.onnx` subpath. Obtain both files from the pinned revision above. This avoids a runtime network download and supports isolated render/processing hosts. `ALIGN_THREADS` controls ONNX CPU threads (default 2, bounded to 1–8).

## External or multilingual service

Set `ALIGNMENT_URL` on the Node API process to use a separate local, GPU or hosted forced-alignment provider instead of managed CPU processing:

```sh
ALIGNMENT_URL=http://127.0.0.1:8000/align npm run dev
# Optional: ALIGNMENT_HEALTH_URL=http://127.0.0.1:8000/health
# Optional: ALIGNMENT_TOKEN=...  (set through your environment/secret manager)
```

The administrator-configured endpoint receives `multipart/form-data` fields `audio` and `lyrics`, plus `language=en` from the current English editor. Direct API clients can supply another language supported by their configured service. It must return:

```json
{"words":[{"text":"Hello","start":1.02,"end":1.41,"confidence":0.95},{"text":"world","start":1.42,"end":1.9,"confidence":0.9}]}
```

Times are seconds relative to the beginning of the source audio. Return exactly one word for each supplied whitespace-delimited word, in order. The Node adapter checks supplied-word matches, finite positive-length times, duration bounds and chronology. Case/punctuation differences are accepted for matching while original project text is retained. No provider credential is sent to the browser. Unavailable services or invalid responses do not overwrite lyrics/timings.

The Python API exposes `GET /health` and `POST /align`. Health reports service availability, supported language, pinned model, and whether weights are loaded. `/align` returns 422 for unsupported/unreliable input and 503 for model/dependency/network failures. Keep the service private to the API host, or protect it with an authenticated reverse proxy when exposing it remotely.

## Timing provenance and imported fallbacks

- TXT: distributed **estimated** word timing is an editable starting point, not vocal detection. Automatic alignment can replace it only after a successful measured result.
- Standard LRC/SRT: imported line boundaries; multiword cues are subdivided into **estimated** word boundaries.
- Enhanced LRC: explicit word starts/following boundaries are **imported**. A final word may use the next line/audio end if no terminal cue is present.
- One-word SRT: explicit start/end are **imported**.
- Manual correction: **manual**.
- Valid model/provider result: **aligned** with measured confidence.

Meyda waveform/intensity/bass/onset analysis is separate from vocal alignment. `src/core/analysis.ts` uses 50 ms intensity/bass steps, up to 1,000 waveform peak buckets, adaptive spectral-flux transients and bass-bearing onset candidates. Tempo stays null without enough agreement. These musical estimates do not establish vocal word timing.

## Tests and measured verification

```sh
npm run test:alignment
# Optional actual model/inference test (downloads weights if absent):
ALIGNMENT_SMOKE=1 npm run test:alignment
```

Seven deterministic algorithm/decode tests cover exact supplied words, unsupported characters, CTC repeated-letter constraints, nonuniform word durations, confidence rejection, memory limits, and silent audio rejection. The optional eighth test runs genuine CPU ONNX inference on original FFmpeg/flite synthetic speech mixed with a generated musical tone. It also rejects mismatched lyrics and instrumental-only audio, and verifies absolute word positions after a 21-second lead-in across a model-window boundary.

On 2026-11-07, all eight tests passed on this host with the pinned real model. The phrase “We rise from the ashes and chase the light” produced nine preserved words with nonuniform measured starts at 0.24, 0.40, 0.70, 0.92, 1.14, 1.48, 1.64, 2.04, and 2.16 seconds. This fixture demonstrates model inference, timing and rejection behavior; it does not claim evaluation accuracy on real sung music. The generated verification report is `artifacts/alignment-model-smoke.json`.

The complete browser suite also passed 16 tests on this host, including an opt-in genuine end-to-end test: generated speech plus accompaniment was uploaded through the editor, nine words were aligned by the local service without mocked provider routes, and a 1280×720 H.264/AAC MP4 (2.581 seconds) was downloaded. An extracted frame at 1.2 seconds showed “ashes” highlighted within its measured 1.14–1.40 second interval. The same suite checks automatic imports, opt-out, failure preservation, cancellation and stale-edit protection with explicitly mocked providers. To reproduce the real browser test after starting the app:

```sh
ALIGNMENT_SMOKE=1 npm run test:e2e -- tests/alignment-real.spec.ts
```

The synthesis fixture requires an FFmpeg build with the `flite` filter; this is a test dependency, not a runtime requirement. Evidence is generated under `artifacts/real-alignment/`. The application itself needs FFmpeg audio decoding, not speech synthesis.
