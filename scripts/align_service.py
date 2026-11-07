"""Local CPU vocal alignment service, independent from the rendering host.

Run: .venv-alignment/bin/python -m uvicorn scripts.align_service:app --host 127.0.0.1 --port 8000
The model is downloaded on first alignment and cached; no GPU, PyTorch or WhisperX is required.
"""
import os
import tempfile
import threading
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from scripts.ctc_alignment import CpuAligner, AlignmentError, MODEL_ID, MODEL_REVISION, MAX_DURATION

app = FastAPI(title='LyricForge CPU vocal alignment', version='1.0')
lock = threading.Lock()
aligner = CpuAligner()

@app.get('/health')
def health():
    available = shutil.which('ffmpeg') is not None
    return {'available': available, 'reason': None if available else 'FFmpeg is missing on the alignment host.',
            'provider': 'Local CPU CTC alignment', 'language': 'en', 'languages': ['en'],
            'model': MODEL_ID, 'revision': MODEL_REVISION, 'license': 'Apache-2.0 (upstream)',
            'modelLoaded': aligner.session is not None, 'maxDuration': MAX_DURATION}

@app.post('/align')
def align(audio: UploadFile = File(...), lyrics: str = Form(...), language: str = Form('en')):
    ext = os.path.splitext(audio.filename or '')[1].lower()
    if ext not in ('.wav', '.mp3'):
        raise HTTPException(400, 'Expected MP3 or WAV')
    if not lyrics.strip():
        raise HTTPException(422, 'Supply the original lyrics before aligning.')
    if len(lyrics) > 100_000:
        raise HTTPException(413, 'Lyric transcript is too large.')
    try:
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / ('audio' + ext)
            total = 0
            with filename.open('wb') as temporary:
                while chunk := audio.file.read(1024 * 1024):
                    total += len(chunk)
                    if total > 250 * 1024 * 1024:
                        raise HTTPException(413, 'Audio exceeds 250 MB')
                    temporary.write(chunk)
            # Close the upload before FFmpeg opens it (required on Windows).
            with lock:
                words = aligner.align(str(filename), lyrics, language)
        return {'words': words, 'provider': 'Local CPU CTC alignment', 'model': MODEL_ID}
    except AlignmentError as error:
        raise HTTPException(422, str(error)) from error
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
