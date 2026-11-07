"""CPU CTC forced alignment. Never generates or substitutes transcript words.

The pinned ONNX conversion derives from facebook/wav2vec2-base-960h
(Apache-2.0), https://huggingface.co/facebook/wav2vec2-base-960h.
"""
from __future__ import annotations
import json
import math
import os
from pathlib import Path
import subprocess
import unicodedata
import numpy as np

MODEL_ID = 'Xenova/wav2vec2-base-960h'
MODEL_REVISION = 'a19f851b3d42865797e410752b4c570c871e4825'
SAMPLE_RATE = 16000
FRAME_STRIDE = 320
MAX_DURATION = 600
MAX_DP_CELLS = 75_000_000


class AlignmentError(ValueError):
    """Input cannot be reliably aligned; original timestamps must be retained."""


def transcript_tokens(lyrics: str, vocab: dict[str, int]):
    words = lyrics.split()
    if not words:
        raise AlignmentError('Supply the original lyrics before aligning.')
    if len(words) > 2000:
        raise AlignmentError('Local alignment supports up to 2,000 words. Split long songs into sections.')
    tokens, owners = [], []
    for index, word in enumerate(words):
        normalized = unicodedata.normalize('NFKD', word.replace('’', "'").replace('‘', "'"))
        normalized = ''.join(char for char in normalized if not unicodedata.combining(char)).upper()
        letters = []
        for char in normalized:
            if char in "ABCDEFGHIJKLMNOPQRSTUVWXYZ'":
                letters.append(char)
            elif char.isalnum():
                raise AlignmentError('The bundled model supports English alphabetic lyrics. Use a language-compatible external provider or imported timestamps for numbers and other scripts.')
        if not letters or not any(char.isalpha() for char in letters):
            raise AlignmentError(f'Word {index + 1} has no supported spoken letters. Correct the transcript or import timestamps.')
        if index:
            tokens.append(vocab['|']); owners.append(-1)
        for char in letters:
            tokens.append(vocab[char]); owners.append(index)
    return words, np.asarray(tokens, dtype=np.int32), np.asarray(owners, dtype=np.int32)


def force_align(log_probs: np.ndarray, token_ids: np.ndarray, blank_id: int = 0):
    """Viterbi over the exact extended CTC sequence, including repeated-letter rules.

    Returns one state for each emission frame. Blanks may occupy leading/trailing
    instrumental regions; no synthetic timestamps are inserted.
    """
    frames, _ = log_probs.shape
    count = len(token_ids)
    if not count or frames < count:
        raise AlignmentError('The supplied lyrics cannot fit this audio.')
    states = np.full(count * 2 + 1, blank_id, dtype=np.int32)
    states[1::2] = token_ids
    if frames * len(states) > MAX_DP_CELLS:
        raise AlignmentError('This song/transcript exceeds the local alignment memory budget. Split it into sections or use an external alignment service.')
    previous = np.full(len(states), -np.inf, dtype=np.float32)
    previous[0] = 0
    back = np.zeros((frames, len(states)), dtype=np.uint8)
    skip = np.zeros(len(states), dtype=bool)
    skip[2:] = (states[2:] != blank_id) & (states[2:] != states[:-2])
    for frame in range(frames):
        advance = np.concatenate(([-np.inf], previous[:-1]))
        jump = np.concatenate(([-np.inf, -np.inf], previous[:-2]))
        jump[~skip] = -np.inf
        best = np.maximum(previous, advance)
        decision = np.where(advance > previous, 1, 0).astype(np.uint8)
        better_jump = jump > best
        decision[better_jump] = 2
        best[better_jump] = jump[better_jump]
        previous = (best + log_probs[frame, states]).astype(np.float32)
        back[frame] = decision
    state = len(states) - (1 if previous[-1] >= previous[-2] else 2)
    if not np.isfinite(previous[state]):
        raise AlignmentError('No valid alignment path exists for these lyrics.')
    path = np.empty(frames, dtype=np.int32)
    for frame in range(frames - 1, -1, -1):
        path[frame] = state
        state -= int(back[frame, state])
    if state != 0:
        raise AlignmentError('The transcript did not align completely.')
    return path


def words_from_path(log_probs, path, token_ids, owners, words, frame_starts, duration,
                    min_word_confidence=.12, min_mean_confidence=.45):
    result = []
    for word_index, word in enumerate(words):
        token_indices = np.flatnonzero(owners == word_index)
        assigned = []
        character_scores = []
        for token_index in token_indices:
            indexes = np.flatnonzero(path == int(token_index) * 2 + 1)
            if not indexes.size:
                raise AlignmentError(f'Could not align word {word_index + 1}. Your existing timings were kept.')
            assigned.extend(indexes.tolist())
            character_scores.append(float(np.exp(np.max(log_probs[indexes, token_ids[token_index]]))))
        confidence = float(np.exp(np.mean(np.log(np.maximum(character_scores, 1e-12)))))
        if confidence < min_word_confidence:
            raise AlignmentError(f'Low confidence at word {word_index + 1} ("{word}"). Check the lyrics, use a clearer vocal mix, or correct timestamps manually.')
        start = float(frame_starts[min(assigned)])
        end = min(duration, float(frame_starts[max(assigned)]) + FRAME_STRIDE / SAMPLE_RATE)
        if end <= start:
            raise AlignmentError('Alignment produced an invalid word boundary.')
        result.append({'text': word, 'start': round(start, 3), 'end': round(end, 3), 'confidence': round(confidence, 4)})
    mean = float(np.mean([word['confidence'] for word in result]))
    if mean < min_mean_confidence:
        raise AlignmentError('The vocal signal does not support a reliable alignment of these lyrics. Existing timings were kept; try a clearer vocal mix or imported timestamps.')
    return result


def decode_audio(filename: str):
    try:
        process = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', filename,
                                  '-t', str(MAX_DURATION + 1), '-f', 'f32le', '-ac', '1',
                                  '-ar', str(SAMPLE_RATE), 'pipe:1'],
                                 capture_output=True, check=True, timeout=90)
    except FileNotFoundError as error:
        raise RuntimeError('FFmpeg is required on the alignment host.') from error
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise AlignmentError('Could not decode this MP3/WAV file with FFmpeg.') from error
    waveform = np.frombuffer(process.stdout, dtype='<f4').copy()
    duration = len(waveform) / SAMPLE_RATE
    if duration <= .1 or duration > MAX_DURATION:
        raise AlignmentError(f'Local alignment supports audio between 0.1 and {MAX_DURATION} seconds.')
    if not np.isfinite(waveform).all() or float(np.sqrt(np.mean(waveform ** 2))) < .0001:
        raise AlignmentError('The audio is silent or invalid. No vocal alignment was produced.')
    return waveform


class CpuAligner:
    def __init__(self):
        self.session = None
        self.vocab = None

    def load(self):
        if self.session is not None:
            return
        import onnxruntime as ort
        # Standard HTTPS transfers respect proxy settings without optional Xet transport.
        os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
        from huggingface_hub import hf_hub_download
        # A supplied directory supports offline deployment; filenames remain explicit.
        directory = os.environ.get('ALIGN_MODEL_DIR')
        def model_file(name):
            if directory:
                candidate = Path(directory) / name
                if not candidate.is_file():
                    candidate = Path(directory) / Path(name).name
                if not candidate.is_file():
                    raise RuntimeError(f'Missing offline alignment model file: {name}')
                return str(candidate)
            return hf_hub_download(MODEL_ID, filename=name, revision=MODEL_REVISION)
        try:
            vocab = json.loads(Path(model_file('vocab.json')).read_text())
            options = ort.SessionOptions()
            options.intra_op_num_threads = max(1, min(8, int(os.environ.get('ALIGN_THREADS', '2'))))
            options.inter_op_num_threads = 1
            session = ort.InferenceSession(model_file('onnx/model_quantized.onnx'), sess_options=options,
                                           providers=['CPUExecutionProvider'])
        except Exception as error:
            raise RuntimeError(f'Could not load the CPU alignment model. Check network/model cache or set ALIGN_MODEL_DIR. {error}') from error
        self.vocab, self.session = vocab, session

    def emissions(self, waveform):
        self.load()
        chunk = 20 * SAMPLE_RATE
        context = SAMPLE_RATE
        outputs, starts = [], []
        for core_start in range(0, len(waveform), chunk):
            core_end = min(len(waveform), core_start + chunk)
            window_start = max(0, core_start - context)
            window_end = min(len(waveform), core_end + context)
            audio = waveform[window_start:window_end]
            audio = ((audio - audio.mean()) / math.sqrt(float(audio.var()) + 1e-7)).astype(np.float32)
            inputs = {}
            for spec in self.session.get_inputs():
                if spec.name == 'input_values':
                    inputs[spec.name] = audio[np.newaxis, :]
                elif spec.name == 'attention_mask':
                    inputs[spec.name] = np.ones((1, len(audio)), dtype=np.int64)
                else:
                    raise RuntimeError(f'Unsupported ONNX alignment input: {spec.name}')
            logits = self.session.run(None, inputs)[0][0].astype(np.float32)
            positions = window_start + np.arange(len(logits)) * FRAME_STRIDE
            keep = (positions >= core_start) & (positions < core_end)
            logits = logits[keep]
            logits -= logits.max(axis=-1, keepdims=True)
            logits -= np.log(np.exp(logits).sum(axis=-1, keepdims=True))
            outputs.append(logits)
            starts.append(positions[keep] / SAMPLE_RATE)
        return np.concatenate(outputs), np.concatenate(starts)

    def align(self, filename: str, lyrics: str, language='en'):
        if language not in ('en', 'en-US', 'en-GB'):
            raise AlignmentError('The bundled CPU model currently supports English. Configure a multilingual external service for other languages.')
        waveform = decode_audio(filename)
        self.load()
        words, token_ids, owners = transcript_tokens(lyrics, self.vocab)
        emissions, starts = self.emissions(waveform)
        path = force_align(emissions, token_ids, self.vocab.get('<pad>', 0))
        return words_from_path(emissions, path, token_ids, owners, words, starts,
                               len(waveform) / SAMPLE_RATE)
