# Audio analysis and lyric timing

## What is measured

`src/core/analysis.ts` decodes MP3/WAV with the browser Web Audio API, mixes channels to mono, and measures Meyda RMS, positive FFT spectral flux, and low-frequency energy below 180 Hz. `Analysis.intensity` and `Analysis.bass` use 50 ms steps (20 Hz), starting at time zero. The waveform contains up to 1,000 peak buckets covering the full song. Transients are adaptive spectral-flux peaks; beats are bass-bearing onset candidates with a 250 ms refractory period. Tempo is a measured onset-interval histogram and remains `null` without enough agreement. These are musical estimates, not a guarantee of every beat or downbeat. Everything is deterministic for the same decoded PCM.

## What timing labels mean

- TXT: evenly distributed **estimated** word timings. This is only an editable starting point and does not detect vocals.
- Standard LRC/SRT: imported line boundaries; words within multiword cues are **estimated** by subdivision.
- Enhanced LRC (`[00:01.00]<00:01.00>Hello <00:01.50>world <00:02.00>`): explicit word starts and following boundaries are **imported**. The last word ends at the next line or audio end when no terminal word timestamp is supplied.
- One-word SRT cues: both boundaries are **imported**. Exporting corrected words to SRT preserves all word boundaries.
- Manual edits are **manual**.
- A successful external forced-alignment response is **aligned**. No words are generated or substituted.

Imports reject negative, non-finite, backwards, and out-of-audio timings. Alignment rejects mismatched words, missing words, invalid times, and out-of-order results. Your existing lyrics and timings remain intact if alignment fails.

## Optional local or remote forced alignment

No model, GPU, Python installation, WhisperX deployment, or external account is assumed. Import LRC/SRT or correct timings manually without configuring a service. To enable the Align action, configure the Node API process:

```sh
ALIGNMENT_URL=http://127.0.0.1:8000/align npm run dev
# Optional bearer credential, supplied from your environment/secret manager:
# ALIGNMENT_TOKEN=...
```

The application sends HTTP `multipart/form-data` with an `audio` file and `lyrics` text. The endpoint must return seconds:

```json
{"words":[{"text":"Hello","start":1.02,"end":1.41,"confidence":0.95},{"text":"world","start":1.42,"end":1.9}]}
```

Return exactly one item for each whitespace-delimited supplied lyric word, in order. Case and punctuation differences are accepted for matching, while the project always preserves the user's original spelling and punctuation. Timestamps must be finite, positive-length, chronological, and within the audio duration. Confidence is optional and remains `null` if not supplied. Use an alignment provider that accepts the supplied transcript; an arbitrary transcription response often will not match sung lyrics and will correctly be rejected.

### Reference CPU WhisperX adapter

This optional example is a small local service, not part of the default browser build. Install it in a separate Python virtual environment on a machine where its dependencies are supported. WhisperX, PyTorch, alignment models, FFmpeg, and their dependencies have separate installation/hardware/license requirements. Check the selected language model's license before downloading; the adapter does not select a model on behalf of the user. GPU acceleration is optional. The first request downloads the selected language alignment model.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r scripts/alignment-requirements.txt
uvicorn scripts.align_service:app --host 127.0.0.1 --port 8000
```

```python
import os
import tempfile
import threading
import whisperx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException

app = FastAPI()
lock = threading.Lock()

@app.post('/align')
def align(audio: UploadFile = File(...), lyrics: str = Form(...)):
    # Supplied transcript is forced-aligned; no transcription invents lyrics.
    # Bound this simple whole-clip example to short songs for memory use.
    ext = os.path.splitext(audio.filename or '')[1].lower()
    if ext not in ('.wav', '.mp3'):
        raise HTTPException(400, 'Expected MP3 or WAV')
    with tempfile.NamedTemporaryFile(suffix=ext) as temporary:
        total = 0
        while chunk := audio.file.read(1024 * 1024):
            total += len(chunk)
            if total > 256 * 1024 * 1024:
                raise HTTPException(413, 'Audio exceeds 256 MB')
            temporary.write(chunk)
        temporary.flush()
        waveform = whisperx.load_audio(temporary.name)
    duration = len(waveform) / 16000
    if duration <= 0 or duration > 180:
        raise HTTPException(422, 'Reference adapter supports clips up to 180 seconds')
    if not lyrics.strip():
        raise HTTPException(422, 'Lyrics are required')
    with lock:
        # Set language to the supplied lyric language; do not guess it.
        model, metadata = whisperx.load_align_model(
            language_code=os.environ.get('ALIGN_LANGUAGE', 'en'),
            device=os.environ.get('ALIGN_DEVICE', 'cpu'))
        result = whisperx.align(
            [{'start': 0.0, 'end': duration, 'text': lyrics}],
            model, metadata, waveform,
            device=os.environ.get('ALIGN_DEVICE', 'cpu'),
            return_char_alignments=False)
    words = []
    for item in result.get('word_segments', []):
        if 'start' not in item or 'end' not in item:
            raise HTTPException(422, 'Some words could not be aligned; use imported/manual timestamps')
        words.append({'text': item['word'], 'start': item['start'],
                      'end': item['end'], 'confidence': item.get('score')})
    return {'words': words}
```

The adapter deliberately fails on unsupported words and unalignable audio. Forced alignment of singing is less reliable than speech, especially with distorted vocals, long instrumental passages, or backing vocals; visually review every result. For longer songs, run a production alignment service that segments known vocal regions while preserving absolute timestamps. Never substitute uniform estimates and label them aligned.

The API has a five-minute service timeout and never exposes `ALIGNMENT_TOKEN` to the browser. A remote endpoint receives the supplied audio and lyrics only when the user requests alignment. Keep a remote provider's retention and access policies appropriate for your music.
