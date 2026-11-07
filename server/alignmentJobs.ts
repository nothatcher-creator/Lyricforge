import { randomUUID } from 'node:crypto';
import type { Word } from '../src/core/types';
import { assetPath } from './render';
import { alignProject } from './alignment';
export type AlignmentRequest = {
  audioUrl: string;
  words: Word[];
  duration: number;
  language: string;
};
export type AlignmentJob = {
  id: string;
  status: 'queued' | 'aligning' | 'completed' | 'failed' | 'cancelled';
  progress: number | null;
  words?: Word[];
  error?: string;
  createdAt: number;
};
export function validateAlignmentRequest(input: unknown): AlignmentRequest {
  if (!input || typeof input !== 'object')
    throw new Error('An audio file and lyrics are required.');
  const { audioUrl, words, duration, language = 'en' } = input as AlignmentRequest;
  if (typeof audioUrl !== 'string' || !/\.(mp3|wav)$/i.test(audioUrl))
    throw new Error('Choose an uploaded MP3 or WAV.');
  assetPath(audioUrl);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1800)
    throw new Error('Audio duration must be between zero and 1800 seconds.');
  if (
    !Array.isArray(words) ||
    !words.length ||
    words.length > 20000 ||
    !words.every(
      (w) =>
        typeof w?.text === 'string' &&
        w.text.trim().length > 0 &&
        w.text.length <= 500 &&
        typeof w.id === 'string' &&
        typeof w.lineId === 'string',
    )
  )
    throw new Error('Import your original lyrics before aligning.');
  if (typeof language !== 'string' || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(language))
    throw new Error('Choose a supported lyric language.');
  return { audioUrl, words: structuredClone(words), duration, language };
}
export class AlignmentQueue {
  readonly jobs = new Map<string, AlignmentJob>();
  private pending: { job: AlignmentJob; request: AlignmentRequest }[] = [];
  private active: { job: AlignmentJob; controller: AbortController } | null = null;
  enqueue(request: AlignmentRequest) {
    if (this.pending.length >= 3)
      throw new Error('The alignment queue is full. Wait for the current song to finish.');
    // Retain a bounded set of completed metadata; words can otherwise consume unbounded memory.
    for (const [id, job] of this.jobs) {
      if (this.jobs.size < 30) break;
      if (['completed', 'failed', 'cancelled'].includes(job.status)) this.jobs.delete(id);
    }
    const job: AlignmentJob = {
      id: randomUUID(),
      status: 'queued',
      progress: null,
      createdAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    this.pending.push({ job, request });
    void this.run();
    return job;
  }
  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued') {
      this.pending = this.pending.filter((item) => item.job.id !== id);
      job.status = 'cancelled';
    } else if (job.status === 'aligning') {
      job.status = 'cancelled';
      if (this.active?.job.id === id) this.active.controller.abort();
    }
    return true;
  }
  close() {
    for (const job of this.jobs.values()) this.cancel(job.id);
  }
  private async run() {
    if (this.active) return;
    const next = this.pending.shift();
    if (!next) return;
    const { job, request } = next;
    const controller = new AbortController();
    this.active = { job, controller };
    job.status = 'aligning';
    try {
      const words = await alignProject(
        assetPath(request.audioUrl),
        request.words,
        request.duration,
        { signal: controller.signal, language: request.language },
      );
      if (job.status === 'aligning') {
        job.words = words;
        job.progress = 100;
        job.status = 'completed';
      }
    } catch (error) {
      if (job.status === 'aligning') {
        job.status = 'failed';
        job.error =
          error instanceof Error
            ? error.message
            : 'Alignment failed. Existing timings are unchanged.';
      }
    } finally {
      this.active = null;
      void this.run();
    }
  }
}
