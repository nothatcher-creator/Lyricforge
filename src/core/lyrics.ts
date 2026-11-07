import type { Word } from './types';

const stamp = (value: string): number => {
  const parts = value.replace(',', '.').split(':').map(Number);
  return parts.reduce((seconds, part) => seconds * 60 + part, 0) * 1000;
};
const tokens = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
const word = (
  text: string,
  startMs: number,
  endMs: number,
  lineId: string,
  index: number,
  source: Word['source'],
): Word => ({
  id: `${lineId}-w${index}`,
  lineId,
  text,
  startMs: Math.round(startMs),
  endMs: Math.round(endMs),
  timestampMs: Math.round((startMs + endMs) / 2),
  confidence: null,
  source,
});

/** Uniform word subdivision is an editable estimate, never forced alignment. */
export function estimateWords(text: string, duration: number): Word[] {
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('Import audio before estimating lyric timing.');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const count = lines.reduce((sum, line) => sum + tokens(line).length, 0);
  let index = 0;
  return lines.flatMap((line, lineIndex) =>
    tokens(line).map((text, wordIndex) => {
      const start = (index++ / count) * duration * 1000;
      return word(
        text,
        start,
        (index / count) * duration * 1000,
        `line-${lineIndex}`,
        wordIndex,
        'estimated',
      );
    }),
  );
}

type Cue = { text: string; start: number; end: number; lineId: string };
function subdivide(cue: Cue): Word[] {
  const words = tokens(cue.text.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, ''));
  return words.map((text, i) =>
    word(
      text,
      cue.start + ((cue.end - cue.start) * i) / words.length,
      cue.start + ((cue.end - cue.start) * (i + 1)) / words.length,
      cue.lineId,
      i,
      words.length === 1 ? 'imported' : 'estimated',
    ),
  );
}

export function parseLyrics(text: string, filename: string, duration: number): Word[] {
  const ext = filename.toLowerCase().split('.').pop();
  const clean = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
  if (ext === 'txt') return estimateWords(clean, duration);
  if (ext === 'srt') {
    const cues: Cue[] = [];
    for (const block of clean.trim().split(/\n\s*\n/)) {
      const lines = block.split('\n');
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) continue;
      const match = lines[timeIndex].match(
        /(\d+:\d{2}:\d{2}[,.]\d+)\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d+)/,
      );
      if (!match) throw new Error('Invalid SRT timestamp. Expected HH:MM:SS,mmm.');
      cues.push({
        text: lines.slice(timeIndex + 1).join(' '),
        start: stamp(match[1]),
        end: stamp(match[2]),
        lineId: `line-${cues.length}`,
      });
    }
    if (!cues.length) throw new Error('No valid SRT cues found.');
    const result = cues.flatMap(subdivide);
    assertValid(result, duration);
    return result;
  }
  if (ext === 'lrc') {
    const offsetMatch = clean.match(/\[offset:([+-]?\d+)\]/i);
    const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
    const entries: { text: string; start: number }[] = [];
    for (const line of clean.split('\n')) {
      const tags = [...line.matchAll(/\[(\d+:\d{2}(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const content = line.replace(/\[\d+:\d{2}(?:\.\d+)?\]/g, '').trim();
      for (const tag of tags)
        entries.push({ text: content, start: Math.max(0, stamp(tag[1]) + offset) });
    }
    entries.sort((a, b) => a.start - b.start);
    if (!entries.length) throw new Error('No timestamped LRC lines found.');
    const result = entries.flatMap((entry, lineIndex) => {
      const end = entries[lineIndex + 1]?.start ?? duration * 1000;
      const matches = [...entry.text.matchAll(/<(\d+:\d{2}(?:\.\d+)?)>([^<]*)/g)];
      if (!matches.length)
        return subdivide({
          text: entry.text,
          start: entry.start,
          end,
          lineId: `line-${lineIndex}`,
        });
      return matches.flatMap((match, index) => {
        const start = Math.max(0, stamp(match[1]) + offset);
        const next = matches[index + 1];
        const stop = next ? Math.max(0, stamp(next[1]) + offset) : end;
        const words = tokens(match[2]);
        return words.map((text, j) =>
          word(
            text,
            start + ((stop - start) * j) / words.length,
            start + ((stop - start) * (j + 1)) / words.length,
            `line-${lineIndex}`,
            index * 100 + j,
            words.length === 1 ? 'imported' : 'estimated',
          ),
        );
      });
    });
    assertValid(result, duration);
    return result;
  }
  throw new Error('Choose a TXT, LRC, or SRT lyric file.');
}

export function validateWords(words: Word[], duration: number): string[] {
  const errors: string[] = [];
  for (const item of words) {
    if (!item.text.trim()) errors.push('Words cannot be empty.');
    if (
      !Number.isFinite(item.startMs) ||
      !Number.isFinite(item.endMs) ||
      item.startMs < 0 ||
      item.endMs <= item.startMs
    )
      errors.push(`“${item.text}” needs a valid start before its end.`);
    if (item.endMs > duration * 1000 + 1) errors.push(`“${item.text}” ends after the audio.`);
  }
  return [...new Set(errors)];
}
function assertValid(words: Word[], duration: number) {
  const errors = validateWords(words, duration);
  if (errors.length) throw new Error(errors[0]);
}
export function lyricsFromWords(words: Word[]): string {
  const lines = new Map<string, string[]>();
  for (const item of words) {
    const line = lines.get(item.lineId) ?? [];
    line.push(item.text);
    lines.set(item.lineId, line);
  }
  return [...lines.values()].map((line) => line.join(' ')).join('\n');
}
function srtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  return `${String(Math.floor(t / 3600000)).padStart(2, '0')}:${String(Math.floor(t / 60000) % 60).padStart(2, '0')}:${String(Math.floor(t / 1000) % 60).padStart(2, '0')},${String(t % 1000).padStart(3, '0')}`;
}
/** One word per cue retains every corrected boundary on re-import. */
export function wordsToSrt(words: Word[]): string {
  return words
    .map((item, i) => `${i + 1}\n${srtTime(item.startMs)} --> ${srtTime(item.endMs)}\n${item.text}`)
    .join('\n\n');
}
