"""Optional CPU/GPU forced alignment. See docs/alignment.md."""
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
