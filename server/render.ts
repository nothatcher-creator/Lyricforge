import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '../src/core/types';

export type Resolution = '720p' | '1080p' | '4k';
export type RenderJob = {
  id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: number;
  url?: string;
  error?: string;
  resolution: Resolution;
};
const ASSET_PATH =
  /^\/uploads\/[a-f0-9-]+\.(?:mp3|wav|png|jpg|jpeg|webp|mp4|webm|woff2?|ttf|otf)$/i;
const SAMPLE_ASSETS = new Set(['/assets/demo.wav', '/assets/cinematic.jpg']);
export const projectRoot = path.resolve(process.cwd());
export function isLocalAsset(value: unknown): value is string {
  return typeof value === 'string' && (ASSET_PATH.test(value) || SAMPLE_ASSETS.has(value));
}
export function assetPath(url: string): string {
  if (!isLocalAsset(url))
    throw new Error('Media must be uploaded to this server before rendering.');
  const file = path.join(projectRoot, 'public', url);
  if (!existsSync(file)) throw new Error(`Media is missing: ${url}. Upload it again.`);
  return file;
}
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && value.length <= max;
export function validateRenderRequest(input: unknown): {
  project: Project;
  resolution: Resolution;
} {
  if (!input || typeof input !== 'object') throw new Error('A project is required.');
  const { project: p, resolution = '1080p' } = input as {
    project: Project;
    resolution: Resolution;
  };
  if (!p || !text(p.id) || !text(p.name) || !text(p.artist) || !text(p.audioName))
    throw new Error('Invalid project metadata.');
  if (!finite(p.duration) || p.duration <= 0 || p.duration > 1800)
    throw new Error('Render duration must be between 0 and 1800 seconds.');
  if (!['16:9', '9:16'].includes(p.aspect)) throw new Error('Choose a supported aspect ratio.');
  if (!['720p', '1080p', '4k'].includes(resolution)) throw new Error('Choose 720p, 1080p, or 4k.');
  if (!isLocalAsset(p.audioUrl) || !/\.(mp3|wav)$/i.test(p.audioUrl))
    throw new Error('Upload an MP3 or WAV before rendering.');
  if (
    !Array.isArray(p.words) ||
    p.words.length > 20000 ||
    !p.words.every(
      (w) =>
        w &&
        text(w.id) &&
        text(w.lineId) &&
        text(w.text, 500) &&
        finite(w.startMs) &&
        finite(w.endMs) &&
        w.startMs >= 0 &&
        w.endMs > w.startMs &&
        w.endMs <= p.duration * 1000 + 1,
    )
  )
    throw new Error('Every word needs valid start/end times inside the song.');
  if (
    !Array.isArray(p.scenes) ||
    p.scenes.length > 500 ||
    !p.scenes.every(
      (s) =>
        s &&
        text(s.id) &&
        text(s.name) &&
        text(s.presetId) &&
        finite(s.start) &&
        finite(s.end) &&
        s.start >= 0 &&
        s.end > s.start &&
        s.end <= p.duration + 0.001 &&
        ['verse', 'chorus', 'bridge', 'breakdown'].includes(s.section) &&
        (!s.background || isLocalAsset(s.background)) &&
        (!s.backgroundType || ['image', 'video'].includes(s.backgroundType)),
    )
  )
    throw new Error('Scenes must have valid times and uploaded backgrounds.');
  const st = p.style;
  if (
    !st ||
    !text(st.fontFamily) ||
    /url\s*\(/i.test(st.fontFamily) ||
    !text(st.color, 50) ||
    !text(st.accent, 50) ||
    !text(st.animation, 50) ||
    !finite(st.fontSize) ||
    st.fontSize < 12 ||
    st.fontSize > 300 ||
    !finite(st.position) ||
    st.position < 0 ||
    st.position > 100 ||
    !finite(st.effects) ||
    st.effects < 0 ||
    st.effects > 100 ||
    typeof st.beatReactive !== 'boolean'
  )
    throw new Error('Invalid visual settings.');
  if (
    st.customFontUrl !== undefined &&
    (!isLocalAsset(st.customFontUrl) || !/\.(woff2?|ttf|otf)$/i.test(st.customFontUrl))
  )
    throw new Error('Custom fonts must be uploaded WOFF, WOFF2, TTF, or OTF files.');
  if (st.textCase !== undefined && !['uppercase', 'lowercase', 'none'].includes(st.textCase))
    throw new Error('Invalid text case.');
  if (p.analysis) {
    const a = p.analysis;
    if (
      !finite(a.duration) ||
      a.duration < 0 ||
      ![a.waveform, a.intensity, a.bass, a.beats, a.transients].every(
        (arr) => Array.isArray(arr) && arr.length < 200000 && arr.every((n) => finite(n) && n >= 0),
      )
    )
      throw new Error('Invalid audio analysis.');
  }
  return { project: structuredClone(p), resolution };
}
export function dimensions(aspect: Project['aspect'], resolution: Resolution) {
  const short = resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : 720;
  const long = (short * 16) / 9;
  return aspect === '9:16' ? { width: short, height: long } : { width: long, height: short };
}
let serveUrl: Promise<string> | null = null;
export function clearBundle() {
  serveUrl = null;
}
function getBundle() {
  if (!serveUrl)
    serveUrl = bundle({
      entryPoint: path.join(projectRoot, 'src/video/index.ts'),
      publicDir: path.join(projectRoot, 'public'),
    }).catch((error) => {
      serveUrl = null;
      throw error;
    });
  return serveUrl;
}
export class RenderQueue {
  readonly jobs = new Map<string, RenderJob>();
  private pending: { job: RenderJob; project: Project }[] = [];
  private active = false;
  private cancelActive: (() => void) | null = null;
  constructor(private origin: string) {}
  enqueue(project: Project, resolution: Resolution) {
    if (this.pending.length >= 4)
      throw new Error('Render queue is full. Wait for an export to finish.');
    assetPath(project.audioUrl);
    if (project.style.customFontUrl) assetPath(project.style.customFontUrl);
    project.scenes.forEach((s) => {
      if (s.background) assetPath(s.background);
    });
    const job: RenderJob = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      resolution,
    };
    this.jobs.set(job.id, job);
    this.pending.push({ job, project });
    void this.run();
    return job;
  }
  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued') {
      this.pending = this.pending.filter((p) => p.job.id !== id);
      job.status = 'cancelled';
    } else if (job.status === 'rendering') {
      job.status = 'cancelled';
      this.cancelActive?.();
    }
    return true;
  }
  private async run() {
    if (this.active) return;
    const next = this.pending.shift();
    if (!next) return;
    this.active = true;
    const { job, project } = next;
    job.status = 'rendering';
    const { cancelSignal, cancel } = makeCancelSignal();
    this.cancelActive = cancel;
    try {
      const renderProject = structuredClone(project);
      renderProject.audioUrl = this.origin + project.audioUrl;
      if (project.style.customFontUrl)
        renderProject.style.customFontUrl = this.origin + project.style.customFontUrl;
      renderProject.scenes = renderProject.scenes.map((s) => ({
        ...s,
        background: s.background ? this.origin + s.background : undefined,
      }));
      const inputProps = { project: renderProject };
      const url = await getBundle();
      const browserExecutable =
        process.env.CHROMIUM_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
      const selected = await selectComposition({
        serveUrl: url,
        id: 'LyricForge',
        inputProps,
        browserExecutable,
      });
      const composition = {
        ...selected,
        ...dimensions(project.aspect, job.resolution),
        durationInFrames: Math.ceil(project.duration * 30),
        fps: 30,
      };
      const output = path.join(projectRoot, 'public', 'renders', `${job.id}.mp4`);
      await mkdir(path.dirname(output), { recursive: true });
      await renderMedia({
        composition,
        serveUrl: url,
        codec: 'h264',
        audioCodec: 'aac',
        outputLocation: output,
        inputProps,
        browserExecutable,
        concurrency: Number(process.env.RENDER_CONCURRENCY) || 2,
        crf: job.resolution === '4k' ? 18 : 20,
        x264Preset: 'fast',
        cancelSignal,
        onProgress: ({ progress }) => {
          job.progress = Math.round(progress * 100);
        },
      });
      if ((job.status as RenderJob['status']) !== 'cancelled') {
        job.status = 'completed';
        job.progress = 100;
        job.url = `/renders/${job.id}.mp4`;
      }
    } catch (error) {
      if ((job.status as RenderJob['status']) !== 'cancelled') {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Render failed.';
        console.error('Render failed:', error);
      }
    } finally {
      this.active = false;
      this.cancelActive = null;
      void this.run();
    }
  }
}
