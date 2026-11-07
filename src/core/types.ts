import type { Caption } from '@remotion/captions';
export type Word = Caption & {
  id: string;
  lineId: string;
  source: 'manual' | 'imported' | 'estimated' | 'aligned';
};
export type Scene = {
  id: string;
  name: string;
  start: number;
  end: number;
  presetId: string;
  section: 'verse' | 'chorus' | 'bridge' | 'breakdown';
  background?: string;
  backgroundType?: 'image' | 'video';
};
export type Analysis = {
  duration: number;
  waveform: number[];
  intensity: number[];
  bass: number[];
  beats: number[];
  transients: number[];
  bpm: number | null;
};
export type Project = {
  id: string;
  name: string;
  artist: string;
  audioUrl: string;
  audioName: string;
  duration: number;
  words: Word[];
  scenes: Scene[];
  analysis: Analysis | null;
  style: {
    customFontUrl?: string;
    textCase?: 'uppercase' | 'lowercase' | 'none';
    fontFamily: string;
    fontSize: number;
    color: string;
    accent: string;
    position: number;
    animation: string;
    effects: number;
    beatReactive: boolean;
  };
  aspect: '16:9' | '9:16';
  updatedAt: number;
};
export type Preset = {
  id: string;
  name: string;
  genre: string;
  color: string;
  background: string;
  effect: string;
  description: string;
};
