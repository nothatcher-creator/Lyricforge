import type { Project } from './types';
/** Validate untrusted imported project JSON before the editor reads it. */
export function readProject(value: unknown): Project {
  if (!value || typeof value !== 'object')
    throw new Error('Choose a LyricForge project JSON file.');
  const p = value as Project;
  if (
    typeof p.id !== 'string' ||
    typeof p.name !== 'string' ||
    typeof p.audioUrl !== 'string' ||
    typeof p.audioName !== 'string' ||
    !Number.isFinite(p.duration) ||
    p.duration <= 0 ||
    p.duration > 1800 ||
    !['16:9', '9:16'].includes(p.aspect)
  )
    throw new Error('This project has invalid metadata or duration.');
  if (
    !Array.isArray(p.words) ||
    p.words.length > 20000 ||
    !p.words.every(
      (w) =>
        typeof w?.text === 'string' &&
        typeof w.id === 'string' &&
        typeof w.lineId === 'string' &&
        Number.isFinite(w.startMs) &&
        Number.isFinite(w.endMs) &&
        w.startMs >= 0 &&
        w.endMs > w.startMs &&
        w.endMs <= p.duration * 1000 + 1,
    )
  )
    throw new Error('Project lyric timings are invalid.');
  if (
    !Array.isArray(p.scenes) ||
    p.scenes.length < 1 ||
    p.scenes.length > 500 ||
    !p.scenes.every(
      (s) =>
        typeof s?.id === 'string' &&
        typeof s.name === 'string' &&
        typeof s.presetId === 'string' &&
        Number.isFinite(s.start) &&
        Number.isFinite(s.end) &&
        s.start >= 0 &&
        s.end > s.start &&
        s.end <= p.duration + 0.001,
    )
  )
    throw new Error('Project scene timings are invalid.');
  const st = p.style;
  if (
    !st ||
    typeof st.fontFamily !== 'string' ||
    typeof st.color !== 'string' ||
    typeof st.accent !== 'string' ||
    typeof st.animation !== 'string' ||
    ![st.fontSize, st.position, st.effects].every(Number.isFinite) ||
    st.fontSize < 12 ||
    st.fontSize > 300 ||
    st.effects < 0 ||
    st.effects > 100 ||
    typeof st.beatReactive !== 'boolean'
  )
    throw new Error('Project visual settings are invalid.');
  if (
    p.analysis &&
    ![
      p.analysis.waveform,
      p.analysis.intensity,
      p.analysis.bass,
      p.analysis.beats,
      p.analysis.transients,
    ].every((a) => Array.isArray(a) && a.every((n) => Number.isFinite(n) && n >= 0))
  )
    throw new Error('Project audio analysis is invalid.');
  const media = [p.audioUrl, st.customFontUrl, ...p.scenes.map((s) => s.background)].filter(
    Boolean,
  ) as string[];
  if (media.some((url) => !/^\/(?:uploads|assets)\/[a-z0-9._-]+$/i.test(url)))
    throw new Error('Project media must reference files uploaded to this studio.');
  return p;
}
