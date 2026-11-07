import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateWords,
  parseLyrics,
  validateWords,
  wordsToSrt,
  lyricsFromWords,
} from '../src/core/lyrics';
import { analyzeSamples, ANALYSIS_STEP } from '../src/core/analysis';
import { validateAlignment } from '../server/alignment';

test('TXT estimates preserve supplied words and explicitly mark estimates', () => {
  const words = parseLyrics('First line\nSecond line', 'lyrics.txt', 8);
  assert.deepEqual(
    words.map((item) => item.text),
    ['First', 'line', 'Second', 'line'],
  );
  assert.ok(words.every((item) => item.source === 'estimated'));
  assert.equal(words[0].startMs, 0);
  assert.equal(words.at(-1)?.endMs, 8000);
  assert.equal(lyricsFromWords(words), 'First line\nSecond line');
});
test('LRC honors multiple timestamps and line word subdivision remains estimated', () => {
  const words = parseLyrics('[00:01.00][00:04.00]Hello world\n[00:06.00]Home', 'a.lrc', 8);
  assert.equal(words.length, 5);
  assert.equal(words[0].startMs, 1000);
  assert.equal(words[2].startMs, 4000);
  assert.equal(words[0].source, 'estimated');
  assert.equal(words[4].source, 'imported');
});
test('enhanced LRC preserves supplied word boundaries and offset', () => {
  const words = parseLyrics(
    '[offset:100]\n[00:01.00]<00:01.00>Hello <00:01.50>world <00:02.00>',
    'a.lrc',
    3,
  );
  assert.equal(words[0].startMs, 1100);
  assert.equal(words[0].endMs, 1600);
  assert.equal(words[1].startMs, 1600);
  assert.equal(words[1].endMs, 2100);
  assert.ok(words.every((item) => item.source === 'imported'));
});
test('SRT retains cue timestamps; per-word estimates are labeled', () => {
  const words = parseLyrics(
    '1\n00:00:01,000 --> 00:00:03,000\nHello world\n\n2\n00:00:04,000 --> 00:00:05,000\nHome',
    'a.srt',
    6,
  );
  assert.equal(words[0].startMs, 1000);
  assert.equal(words[1].endMs, 3000);
  assert.equal(words[2].source, 'imported');
  const roundtrip = parseLyrics(wordsToSrt(words), 'corrected.srt', 6);
  assert.deepEqual(
    roundtrip.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })),
    words.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })),
  );
});
test('invalid timestamps are rejected rather than silently clamped', () => {
  assert.throws(() => parseLyrics('1\n00:00:03,000 --> 00:00:01,000\nOops', 'a.srt', 5));
  assert.throws(() => parseLyrics('[00:12.00]Past audio', 'a.lrc', 5));
  assert.throws(() => estimateWords('Song', 0));
  const words = estimateWords('One two', 2);
  words[0].startMs = NaN;
  assert.ok(validateWords(words, 2).length);
});
test('alignment only accepts exact supplied words and finite ordered timing', () => {
  const words = estimateWords('Hello world', 3);
  const aligned = validateAlignment(
    {
      words: [
        { text: 'hello', start: 0.3, end: 0.6 },
        { text: 'World!', start: 1, end: 1.8 },
      ],
    },
    words,
    3,
  );
  assert.deepEqual(
    aligned.map((item) => item.text),
    ['Hello', 'world'],
  );
  assert.ok(aligned.every((item) => item.source === 'aligned'));
  assert.throws(
    () =>
      validateAlignment(
        {
          words: [
            { text: 'invented', start: 0.3, end: 0.6 },
            { text: 'world', start: 1, end: 1.8 },
          ],
        },
        words,
        3,
      ),
    /does not match/,
  );
  assert.throws(
    () => validateAlignment({ words: [{ text: 'hello', start: 0.3, end: 0.6 }] }, words, 3),
    /1 words for 2/,
  );
  assert.throws(
    () =>
      validateAlignment(
        {
          words: [
            { text: 'hello', start: 0.3, end: 0.6 },
            { text: 'world', start: 1, end: 4 },
          ],
        },
        words,
        3,
      ),
    /after the audio/,
  );
});
test('analysis extracts real waveform and repeated onsets with deterministic results', () => {
  const rate = 16000,
    duration = 6,
    samples = new Float32Array(rate * duration);
  for (let pulse = 0.5; pulse < duration; pulse += 0.5)
    for (let n = 0; n < rate * 0.12; n++)
      samples[Math.floor(pulse * rate) + n] =
        Math.sin((n / rate) * 2 * Math.PI * 90) * Math.exp(-n / (rate * 0.025));
  const result = analyzeSamples(samples, rate);
  assert.equal(result.duration, duration);
  assert.equal(result.waveform.length, 1000);
  assert.equal(result.intensity.length, Math.ceil(duration / ANALYSIS_STEP));
  assert.ok(result.beats.length >= 5);
  assert.ok(result.transients.length >= 5);
  assert.ok(result.bpm !== null && Math.abs(result.bpm - 120) <= 4);
  assert.deepEqual(result, analyzeSamples(samples, rate));
});
test('silence reports no detected tempo or invented beats', () => {
  const result = analyzeSamples(new Float32Array(16000), 16000);
  assert.equal(result.bpm, null);
  assert.deepEqual(result.beats, []);
  assert.deepEqual(result.transients, []);
});
