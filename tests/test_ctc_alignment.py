"""Alignment algorithm tests; set ALIGNMENT_SMOKE=1 for actual model inference.

Run: .venv-alignment/bin/python -m unittest discover -s tests -p test_ctc_alignment.py
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import wave
import numpy as np
from scripts import ctc_alignment as ctc

VOCAB = {'<pad>': 0, '|': 1, "'": 2, **{char: index + 3 for index, char in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}}


def emissions_for(tokens):
    sequence = [0, 0]
    for index, token in enumerate(tokens):
        sequence.extend([int(token)] * (1 + index % 3))
        sequence.extend([0, 0])
    sequence.extend([0, 0])
    logits = np.full((len(sequence), len(VOCAB)), -10, dtype=np.float32)
    logits[np.arange(len(sequence)), sequence] = 0
    return logits - np.log(np.exp(logits).sum(axis=1, keepdims=True))


class CtcTests(unittest.TestCase):
    def test_original_words_and_punctuation_are_preserved(self):
        words, tokens, owners = ctc.transcript_tokens('We, don’t STOP!', VOCAB)
        self.assertEqual(words, ['We,', 'don’t', 'STOP!'])
        self.assertEqual(len(tokens), len(owners))
        self.assertIn(VOCAB["'"], tokens)

    def test_unsupported_words_fail_without_substitution(self):
        for text in ['We have 2 songs', '你好 world', '...', '']:
            with self.subTest(text=text), self.assertRaises(ctc.AlignmentError):
                ctc.transcript_tokens(text, VOCAB)

    def test_viterbi_aligns_repeated_letters_and_nonuniform_word_boundaries(self):
        words, tokens, owners = ctc.transcript_tokens('BOOK a room', VOCAB)
        probabilities = emissions_for(tokens)
        path = ctc.force_align(probabilities, tokens)
        result = ctc.words_from_path(probabilities, path, tokens, owners, words,
                                     np.arange(len(path)) * .02, len(path) * .02)
        self.assertEqual([word['text'] for word in result], words)
        self.assertTrue(all(word['confidence'] > .99 for word in result))
        self.assertLess(result[0]['end'], result[1]['start'])
        self.assertNotAlmostEqual(result[0]['end'] - result[0]['start'], result[1]['end'] - result[1]['start'])
        # The repeated O labels occupy distinct CTC states separated by blank.
        first_o, second_o = np.flatnonzero(tokens == VOCAB['O'])[:2]
        first_frames = np.flatnonzero(path == first_o * 2 + 1)
        second_frames = np.flatnonzero(path == second_o * 2 + 1)
        self.assertGreater(second_frames[0], first_frames[-1] + 1)

    def test_low_confidence_forced_path_is_rejected(self):
        words, tokens, owners = ctc.transcript_tokens('WRONG', VOCAB)
        probabilities = np.full((80, len(VOCAB)), -15, dtype=np.float32)
        probabilities[:, 0] = 0
        path = ctc.force_align(probabilities, tokens)
        with self.assertRaisesRegex(ctc.AlignmentError, 'Low confidence'):
            ctc.words_from_path(probabilities, path, tokens, owners, words, np.arange(80) * .02, 1.6)

    def test_audio_cannot_fit_too_many_characters(self):
        _, tokens, _ = ctc.transcript_tokens('TOO MANY WORDS', VOCAB)
        with self.assertRaisesRegex(ctc.AlignmentError, 'cannot fit'):
            ctc.force_align(np.zeros((2, len(VOCAB)), dtype=np.float32), tokens)

    def test_budget_is_enforced_before_allocating_matrix(self):
        _, tokens, _ = ctc.transcript_tokens('WORDS', VOCAB)
        original = ctc.MAX_DP_CELLS
        try:
            ctc.MAX_DP_CELLS = 10
            with self.assertRaisesRegex(ctc.AlignmentError, 'memory budget'):
                ctc.force_align(np.zeros((30, len(VOCAB)), dtype=np.float32), tokens)
        finally:
            ctc.MAX_DP_CELLS = original

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg required for decode test')
    def test_silent_audio_fails_before_model_inference(self):
        with tempfile.NamedTemporaryFile(suffix='.wav') as file:
            with wave.open(file.name, 'wb') as audio:
                audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
                audio.writeframes(bytes(16000 * 2))
            with self.assertRaisesRegex(ctc.AlignmentError, 'silent'):
                ctc.decode_audio(file.name)


@unittest.skipUnless(os.environ.get('ALIGNMENT_SMOKE') == '1', 'Set ALIGNMENT_SMOKE=1 to download/load the real model')
class ModelSmoke(unittest.TestCase):
    def test_actual_speech_with_music_and_mismatch_rejection(self):
        phrase = 'We rise from the ashes and chase the light'
        with tempfile.TemporaryDirectory() as directory:
            speech = str(Path(directory) / 'speech.wav')
            mixed = str(Path(directory) / 'mixed.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'flite=text={phrase}:voice=slt', '-ar', '16000', '-y', speech], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', speech, '-f', 'lavfi', '-i', 'sine=frequency=110:sample_rate=16000:duration=3', '-filter_complex', '[1:a]volume=0.04[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0', '-y', mixed], check=True)
            model = ctc.CpuAligner()
            result = model.align(mixed, phrase)
            self.assertEqual([word['text'] for word in result], phrase.split())
            self.assertTrue(all(0 <= word['start'] < word['end'] < 3 for word in result))
            self.assertLess(result[0]['start'], .5)
            self.assertGreater(result[-1]['start'], 2)
            with self.assertRaises(ctc.AlignmentError):
                model.align(speech, 'Purple elephants dance upon silent oceans')
            with self.assertRaises(ctc.AlignmentError):
                model.align('tests/fixtures/studio-test.wav', 'Signal in motion')
            # Verify chunk-boundary offsets with an actual long instrumental lead-in.
            delayed = str(Path(directory) / 'delayed.wav')
            short_phrase = 'We rise from the ashes'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'flite=text={short_phrase}:voice=slt', '-af', 'adelay=21000:all=1', '-ar', '16000', '-y', delayed], check=True)
            delayed_result = model.align(delayed, short_phrase)
            self.assertGreater(delayed_result[0]['start'], 21)
            self.assertLess(delayed_result[0]['start'], 21.6)
            self.assertGreater(delayed_result[-1]['start'], 22)
            Path('artifacts').mkdir(exist_ok=True)
            Path('artifacts/alignment-model-smoke.json').write_text(json.dumps({'model': ctc.MODEL_ID, 'revision': ctc.MODEL_REVISION, 'fixture': 'Original FFmpeg/flite synthetic speech mixed with generated sine accompaniment; no sung-vocal accuracy claim', 'words': result, 'delayedWords': delayed_result, 'mismatchedTranscriptRejected': True, 'instrumentalRejected': True}, indent=2))


if __name__ == '__main__':
    unittest.main()
