import Meyda from 'meyda';
import type { Analysis } from './types';

/** intensity and bass arrays are sampled at exactly 20Hz. */
export const ANALYSIS_STEP = 0.05;
const mean = (items: number[]) => items.reduce((a, b) => a + b, 0) / Math.max(1, items.length);
const normalize = (values: number[]) => {
  const max = Math.max(0.000001, ...values);
  return values.map((value) => Math.max(0, Math.min(1, value / max)));
};

/** CPU analysis independent of DOM, shared with tests and background workers. */
export function analyzeSamples(samples: Float32Array, sampleRate: number): Analysis {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length === 0)
    throw new Error('Audio contains no decodable samples.');
  const duration = samples.length / sampleRate;
  if (duration > 3600) throw new Error('Please choose audio shorter than one hour.');
  const bins = Math.min(1000, samples.length);
  const waveform = Array.from({ length: bins }, (_, i) => {
    const from = Math.floor((i * samples.length) / bins),
      to = Math.floor(((i + 1) * samples.length) / bins);
    let peak = 0;
    for (let j = from; j < to; j++) peak = Math.max(peak, Math.abs(samples[j]));
    return peak;
  });
  const intensity: number[] = [],
    bass: number[] = [],
    flux: number[] = [];
  const size = 2048,
    hop = Math.round(sampleRate * ANALYSIS_STEP);
  Meyda.bufferSize = size;
  Meyda.sampleRate = sampleRate;
  Meyda.windowingFunction = 'hanning';
  let previous: Float32Array | null = null;
  for (let offset = 0; offset < samples.length; offset += hop) {
    const frame = new Float32Array(size);
    frame.set(samples.subarray(offset, offset + size));
    const features = Meyda.extract(['rms', 'amplitudeSpectrum'], frame);
    const energy = features?.rms ?? 0;
    const spectrum = features?.amplitudeSpectrum ?? new Float32Array(size / 2);
    intensity.push(Number.isFinite(energy) ? energy : 0);
    const bassBin = Math.min(spectrum.length, Math.max(2, Math.ceil((180 * size) / sampleRate)));
    let low = 0,
      change = 0;
    for (let b = 1; b < spectrum.length; b++) {
      if (b < bassBin) low += spectrum[b];
      if (previous) change += Math.max(0, spectrum[b] - previous[b]);
    }
    bass.push(low / bassBin);
    flux.push(change / spectrum.length);
    previous = spectrum;
  }
  const level = normalize(intensity),
    low = normalize(bass),
    onsets: number[] = [],
    beatCandidates: number[] = [];
  for (let i = 2; i < flux.length - 1; i++) {
    const local = flux.slice(Math.max(0, i - 12), Math.min(flux.length, i + 12));
    const threshold = mean(local) * 1.65;
    const time = i * ANALYSIS_STEP;
    if (
      flux[i] > threshold &&
      flux[i] > flux[i - 1] &&
      flux[i] >= flux[i + 1] &&
      level[i] > 0.08 &&
      time - (onsets.at(-1) ?? -1) > 0.12
    ) {
      onsets.push(time);
      if (low[i] > 0.12 && time - (beatCandidates.at(-1) ?? -1) > 0.25) beatCandidates.push(time);
    }
  }
  // Tempo is derived only when repeated onset intervals agree; no default BPM.
  const histogram = new Map<number, number>();
  for (let i = 1; i < beatCandidates.length; i++) {
    const interval = beatCandidates[i] - beatCandidates[i - 1];
    if (interval < 0.25 || interval > 2) continue;
    let bpm = 60 / interval;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const key = Math.round(bpm / 2) * 2;
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  const best = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0];
  const bpm =
    best && best[1] >= 3 && best[1] / Math.max(1, beatCandidates.length - 1) > 0.25
      ? best[0]
      : null;
  return {
    duration,
    waveform: normalize(waveform),
    intensity: level,
    bass: low,
    beats: beatCandidates,
    transients: onsets,
    bpm,
  };
}

export async function analyzeAudio(file: File | ArrayBuffer): Promise<Analysis> {
  const bytes = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const mono = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const source = decoded.getChannelData(channel);
      for (let i = 0; i < mono.length; i++) mono[i] += source[i] / decoded.numberOfChannels;
    }
    return analyzeSamples(mono, decoded.sampleRate);
  } finally {
    await context.close();
  }
}
