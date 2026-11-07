import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Word } from '../src/core/types';
import { lyricsFromWords, validateWords } from '../src/core/lyrics';

/** Administrator-configured service; request bodies cannot choose arbitrary URLs. */
export const alignmentAvailable = Boolean(process.env.ALIGNMENT_URL);
export function alignmentStatus() {
  return {
    available: alignmentAvailable,
    provider: alignmentAvailable
      ? 'Configured word-alignment service'
      : 'Import LRC/SRT or edit estimated timings',
  };
}
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

type AlignedWord = { text: string; start: number; end: number; confidence?: number };
export function validateAlignment(value: unknown, words: Word[], duration = Infinity): Word[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { words?: unknown }).words))
    throw new Error('Alignment service must return {words:[{text,start,end}]} in seconds.');
  const result = (value as { words: AlignedWord[] }).words;
  if (result.length !== words.length)
    throw new Error(
      `Alignment returned ${result.length} words for ${words.length} supplied words. Your lyrics were kept; import corrected timestamps or retry with an accurate transcript.`,
    );
  const aligned = result.map((item, index) => {
    if (
      !item ||
      typeof item.text !== 'string' ||
      normalize(item.text) !== normalize(words[index].text)
    )
      throw new Error(
        `Alignment does not match supplied lyric word ${index + 1}. Your lyrics were kept unchanged.`,
      );
    if (
      typeof item.start !== 'number' ||
      typeof item.end !== 'number' ||
      !Number.isFinite(item.start) ||
      !Number.isFinite(item.end)
    )
      throw new Error('Alignment returned invalid timestamps.');
    const startMs = Math.round(item.start * 1000),
      endMs = Math.round(item.end * 1000);
    return {
      ...words[index],
      startMs,
      endMs,
      timestampMs: Math.round((startMs + endMs) / 2),
      confidence:
        typeof item.confidence === 'number' && Number.isFinite(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : null,
      source: 'aligned' as const,
    };
  });
  const errors = validateWords(aligned, duration);
  if (errors.length) throw new Error(errors[0]);
  for (let i = 1; i < aligned.length; i++)
    if (aligned[i].startMs < aligned[i - 1].startMs)
      throw new Error('Alignment returned words out of chronological order.');
  return aligned;
}

export async function alignProject(
  audioPath: string,
  words: Word[],
  duration = Infinity,
): Promise<Word[]> {
  const endpoint = process.env.ALIGNMENT_URL;
  if (!endpoint)
    throw new Error(
      'Automatic vocal alignment is not configured. Import LRC/SRT timestamps or manually correct the estimated word timings. Configure ALIGNMENT_URL for a local or remote forced-alignment service.',
    );
  if (!words.length) throw new Error('Import lyrics before aligning.');
  const details = await stat(audioPath);
  if (details.size > 256 * 1024 * 1024)
    throw new Error('Alignment supports audio files up to 256 MB.');
  const bytes = await readFile(audioPath);
  const multipart = new FormData();
  const type = path.extname(audioPath).toLowerCase() === '.wav' ? 'audio/wav' : 'audio/mpeg';
  multipart.append('audio', new Blob([new Uint8Array(bytes)], { type }), path.basename(audioPath));
  multipart.append('lyrics', lyricsFromWords(words));
  const headers: Record<string, string> = {};
  if (process.env.ALIGNMENT_TOKEN) headers.Authorization = `Bearer ${process.env.ALIGNMENT_TOKEN}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: multipart,
    headers,
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok)
    throw new Error(
      `Alignment service failed (${response.status}). Your existing timings were kept.`,
    );
  return validateAlignment(await response.json(), words, duration);
}
export async function alignLyrics({
  audioPath,
  lyrics,
  duration,
}: {
  audioPath: string;
  lyrics: string;
  duration: number;
}): Promise<Word[]> {
  const { estimateWords } = await import('../src/core/lyrics');
  return alignProject(audioPath, estimateWords(lyrics, duration), duration);
}
