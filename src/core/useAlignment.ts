import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, Word } from './types';
type Status = {
  available: boolean;
  provider: string;
  reason?: string;
  languages: string[];
  mode?: string;
  modelLoaded?: boolean;
};
type Job = {
  id: string;
  status: 'queued' | 'aligning' | 'completed' | 'failed' | 'cancelled' | 'discarded';
  progress: number | null;
  words?: Word[];
  error?: string;
};
const fingerprint = (p: Project) =>
  JSON.stringify([
    p.id,
    p.audioUrl,
    p.duration,
    p.words.map((w) => [w.id, w.lineId, w.text, w.startMs, w.endMs, w.source]),
  ]);
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
async function api(path: string, options?: RequestInit) {
  const response = await fetch(base + path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Alignment request failed.');
  return value;
}
export function useAlignment(
  project: Project,
  update: (fn: (p: Project) => Project) => void,
  notify: (message: string) => void,
) {
  const current = useRef(project);
  current.current = project;
  const updateRef = useRef(update);
  updateRef.current = update;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [status, setStatus] = useState<Status>({
    available: false,
    provider: 'Checking alignment service…',
    languages: ['en'],
  });
  const [job, setJob] = useState<Job | null>(null);
  const jobId = useRef<string | null>(null);
  const generation = useRef(0);
  const [autoEnabled, setAutoState] = useState(() => {
    try {
      return localStorage.getItem('lyricforge-auto-align') !== 'false';
    } catch {
      return true;
    }
  });
  const refresh = useCallback(async () => {
    try {
      const value: Status = await api('/api/alignment/status');
      setStatus(value);
      return value;
    } catch {
      const value = {
        available: false,
        provider: 'Alignment service unavailable',
        reason: 'Start the LyricForge API and local alignment service.',
        languages: ['en'],
      };
      setStatus(value);
      return value;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 10000);
    return () => {
      clearInterval(interval);
    };
  }, [refresh]);
  useEffect(
    () => () => {
      generation.current++;
      const id = jobId.current;
      if (id) void api(`/api/alignment-jobs/${id}`, { method: 'DELETE' }).catch(() => {});
    },
    [],
  );
  const setAutoEnabled = (enabled: boolean) => {
    setAutoState(enabled);
    try {
      localStorage.setItem('lyricforge-auto-align', String(enabled));
    } catch {}
  };
  const cancel = useCallback(async () => {
    generation.current++;
    const id = jobId.current;
    jobId.current = null;
    setJob((previous) => (previous ? { ...previous, status: 'cancelled' } : null));
    if (id)
      try {
        await api(`/api/alignment-jobs/${id}`, { method: 'DELETE' });
      } catch {}
  }, []);
  const align = useCallback(
    async (target: Project = current.current) => {
      const version = ++generation.current;
      const previousId = jobId.current;
      jobId.current = null;
      if (previousId)
        void api(`/api/alignment-jobs/${previousId}`, { method: 'DELETE' }).catch(() => {});
      const expected = fingerprint(target);
      setJob({ id: '', status: 'queued', progress: null });
      try {
        if (!target.audioUrl || !target.words.length)
          throw new Error('Import your song and original lyrics before aligning.');
        const capability = await refresh();
        if (version !== generation.current) return;
        if (!capability.available)
          throw new Error(capability.reason || 'The alignment service is unavailable.');
        let result: Job = await api('/api/alignment-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioUrl: target.audioUrl,
            words: target.words,
            duration: target.duration,
            language: 'en',
          }),
        });
        if (version !== generation.current) {
          void api(`/api/alignment-jobs/${result.id}`, { method: 'DELETE' }).catch(() => {});
          return;
        }
        jobId.current = result.id;
        setJob(result);
        while (['queued', 'aligning'].includes(result.status)) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (version !== generation.current) return;
          result = await api(`/api/alignment-jobs/${result.id}`);
          if (version !== generation.current) return;
          setJob(result);
        }
        jobId.current = null;
        if (result.status === 'completed') {
          if (fingerprint(current.current) !== expected) {
            setJob({ ...result, status: 'discarded' });
            notifyRef.current(
              'Alignment finished. Your newer lyric or timing edits were preserved. Retry alignment to use the updated lyrics.',
            );
            return;
          }
          const words = result.words;
          if (
            !Array.isArray(words) ||
            words.length !== target.words.length ||
            !words.every(
              (w, i) =>
                w.id === target.words[i].id &&
                w.text === target.words[i].text &&
                w.source === 'aligned' &&
                Number.isFinite(w.startMs) &&
                Number.isFinite(w.endMs) &&
                w.startMs >= 0 &&
                w.endMs > w.startMs &&
                w.endMs <= target.duration * 1000 + 1,
            )
          )
            throw new Error('The alignment response was invalid. Existing timings were kept.');
          updateRef.current((p) => (fingerprint(p) === expected ? { ...p, words } : p));
          notifyRef.current('Vocal alignment complete. Review the word timings before export.');
        } else if (result.status === 'failed')
          throw new Error(result.error || 'Alignment failed. Your original timings are unchanged.');
      } catch (error) {
        if (version !== generation.current) return;
        jobId.current = null;
        const message = (error as Error).message;
        setJob({ id: '', status: 'failed', progress: null, error: message });
        notifyRef.current(message);
      }
    },
    [refresh],
  );
  const autoAlign = (target: Project) => {
    if (
      autoEnabled &&
      target.audioUrl &&
      target.words.length &&
      target.words.every((w) => w.source === 'estimated')
    )
      void align(target);
  };
  return {
    status,
    job,
    autoEnabled,
    setAutoEnabled,
    align,
    autoAlign,
    cancel,
    refresh,
    processing: job?.status === 'queued' || job?.status === 'aligning',
  };
}
