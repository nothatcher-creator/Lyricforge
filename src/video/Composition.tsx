import React, { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  delayRender,
  continueRender,
  cancelRender,
} from 'remotion';
import { Audio, Video } from '@remotion/media';
import type { Project, Scene, Word } from '../core/types';
import { presets } from '../core/presets';
import { Atmosphere } from './Atmosphere';

export const mediaUrl = (url: string) =>
  url.startsWith('/assets/') || url.startsWith('/fonts/') ? staticFile(url.slice(1)) : url;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ease = (value: number) => 1 - Math.pow(1 - clamp(value), 3);

const fontLoads = new Map<string, Promise<void>>();
function useProjectFont(project: Project) {
  const family = project.style.fontFamily;
  const url =
    family === 'Custom font'
      ? project.style.customFontUrl
      : family === 'Bebas Neue'
        ? '/fonts/bebas-neue.woff2'
        : family === 'Inter'
          ? '/fonts/inter.woff2'
          : undefined;
  const [initialHandle] = useState(() => delayRender('Loading lyric font'));
  const first = useRef(true);
  useEffect(() => {
    const handle = first.current ? initialHandle : delayRender('Loading lyric font');
    first.current = false;
    let settled = false,
      active = true;
    const release = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };
    const key = `${family}:${url ?? 'system'}`;
    if (!fontLoads.has(key))
      fontLoads.set(
        key,
        (async () => {
          if (url) {
            const face = new FontFace(family, `url(${JSON.stringify(mediaUrl(url))})`);
            const loaded = await face.load();
            document.fonts.add(loaded);
          }
          await document.fonts.load(`150px ${JSON.stringify(family)}`);
        })(),
      );
    fontLoads
      .get(key)!
      .then(release)
      .catch((error) => {
        release();
        if (active) cancelRender(new Error(`Could not load the selected font: ${String(error)}`));
      });
    return () => {
      active = false;
      release();
    };
  }, [family, url, initialHandle]);
}

/** The analysis arrays share a documented, fixed 50 ms sampling interval. */
function audioEnergy(project: Project, time: number) {
  if (!project.style.beatReactive || !project.analysis) return { intensity: 0, bass: 0, beat: 0 };
  const position = Math.max(0, time / 0.05),
    index = Math.floor(position),
    fraction = position - index;
  const sample = (data: number[]) =>
    clamp((data[index] ?? 0) * (1 - fraction) + (data[index + 1] ?? data[index] ?? 0) * fraction);
  let beat = 0;
  for (const onset of project.analysis.beats) {
    const distance = time - onset;
    if (distance >= 0 && distance < 0.28) beat = Math.max(beat, Math.exp(-distance * 17));
    if (onset > time) break;
  }
  return {
    intensity: sample(project.analysis.intensity),
    bass: sample(project.analysis.bass),
    beat,
  };
}

const SceneVisual: React.FC<{
  project: Project;
  scene: Scene;
  globalTime: number;
  width: number;
  height: number;
}> = ({ project, scene, globalTime, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const preset = presets.find((item) => item.id === scene.presetId) ?? presets[0];
  const { intensity, bass, beat } = audioEnergy(project, globalTime);
  const energy = clamp(intensity * 0.35 + bass * 0.35 + beat * 0.3);
  const sectionGain =
    scene.section === 'chorus'
      ? 1.35
      : scene.section === 'bridge'
        ? 0.65
        : scene.section === 'breakdown'
          ? 1.5
          : 1;
  const localTime = frame / fps;
  const camera =
    1.035 + Math.min(0.09, localTime * 0.002) + (bass * 0.012 + beat * 0.01) * sectionGain;
  const customStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter:
      scene.presetId === 'cinematic'
        ? 'sepia(.95) saturate(1.6) brightness(.68)'
        : `brightness(${0.56 + intensity * 0.08}) saturate(.85)`,
    scale: camera,
    translate: `${Math.sin(localTime * 0.09) * 12}px ${Math.cos(localTime * 0.07) * 9}px`,
  };
  return (
    <AbsoluteFill style={{ background: preset.background, overflow: 'hidden' }}>
      {scene.background &&
        (scene.backgroundType === 'video' ? (
          <Video
            src={mediaUrl(scene.background)}
            muted
            loop
            premountFor={fps}
            style={customStyle}
          />
        ) : (
          <Img src={mediaUrl(scene.background)} style={customStyle} />
        ))}
      {!scene.background && (
        <AbsoluteFill
          style={{
            background: preset.background,
            scale: camera,
            translate: `${Math.sin(localTime * 0.1) * 20}px ${Math.cos(localTime * 0.12) * 15}px`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            scene.presetId === 'cinematic'
              ? 'linear-gradient(0deg,rgba(17,8,4,.83),rgba(83,40,13,.08) 65%,rgba(10,5,2,.25))'
              : 'linear-gradient(0deg,#07090bb0,transparent 65%,#08090b40)',
        }}
      />
      <Atmosphere
        effect={preset.effect}
        color={preset.color}
        amount={project.style.effects}
        energy={energy * sectionGain}
        width={width}
        height={height}
        section={scene.section}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 65%,${preset.color}25,transparent 68%)`,
          opacity: project.style.beatReactive ? clamp((bass * 0.4 + beat * 0.35) * sectionGain) : 0,
          mixBlendMode: 'screen',
        }}
      />
      {scene.section === 'breakdown' && project.style.effects > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 5px,#0004 5px,#0004 7px)',
            opacity: clamp(0.1 + beat * 0.4),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

function rowsFor(words: Word[], fontSize: number, width: number, fontFamily: string): Word[][] {
  if (words.length <= 3) return [words];
  const split = words.length === 4 ? 2 : Math.max(2, Math.floor(words.length * 0.45));
  const initial = [words.slice(0, split), words.slice(split)];
  const rows: Word[][] = [];
  const charWidth = fontFamily === 'Bebas Neue' ? 0.46 : 0.58;
  for (const row of initial) {
    let current: Word[] = [];
    let length = 0;
    for (const item of row) {
      const next = item.text.length + 1;
      if (current.length && (length + next) * fontSize * charWidth > width) {
        rows.push(current);
        current = [];
        length = 0;
      }
      current.push(item);
      length += next;
    }
    if (current.length) rows.push(current);
  }
  return rows;
}

const LyricType: React.FC<{
  project: Project;
  time: number;
  scene: Scene | undefined;
  width: number;
  height: number;
}> = ({ project, time, scene, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groups = new Map<string, Word[]>();
  for (const word of project.words) {
    const list = groups.get(word.lineId) ?? [];
    list.push(word);
    groups.set(word.lineId, list);
  }
  const line = [...groups.values()].find(
    (words) =>
      time * 1000 >= Math.min(...words.map((word) => word.startMs)) &&
      time * 1000 < Math.max(...words.map((word) => word.endMs)),
  );
  if (!line?.length) return null;
  const start = Math.min(...line.map((word) => word.startMs)) / 1000,
    end = Math.max(...line.map((word) => word.endMs)) / 1000;
  const elapsed = time - start,
    entry = ease(elapsed / 0.42),
    exit = clamp((end - time) / 0.16);
  const animation = project.style.animation;
  const energy = audioEnergy(project, time);
  const sectionGain = scene?.section === 'chorus' ? 1.35 : scene?.section === 'bridge' ? 0.6 : 1;
  const beatScale = 1 + (energy.bass * 0.009 + energy.beat * 0.009) * sectionGain;
  const size = project.style.fontSize;
  const rows = rowsFor(line, size, width * 0.82, project.style.fontFamily);
  const longest = Math.max(...rows.map((row) => row.map((word) => word.text).join(' ').length));
  const safeSize = Math.min(
    size,
    (width * 0.85) /
      (Math.max(1, longest) * (project.style.fontFamily === 'Bebas Neue' ? 0.48 : 0.63)),
  );
  const bounce =
    animation === 'Bounce'
      ? spring({
          frame: Math.max(0, frame - Math.round(start * fps)),
          fps,
          config: { damping: 9, stiffness: 170, mass: 0.6 },
        })
      : 1;
  const glitch = animation === 'Glitch' || scene?.section === 'breakdown';
  const jitter =
    glitch && (elapsed < 0.38 || energy.beat > 0.5)
      ? Math.sin(frame * 2.13) * 8 * (1 - entry + energy.beat * 0.5)
      : 0;
  const scale =
    (animation === 'Scale'
      ? 0.78 + 0.22 * entry
      : animation === 'Bounce'
        ? 0.75 + 0.25 * bounce
        : 1) * beatScale;
  const y =
    animation === 'Rise' ? (1 - entry) * 48 : animation === 'Bounce' ? (1 - bounce) * 44 : 0;
  const x = animation === 'Slide' ? (entry - 1) * 140 : jitter;
  return (
    <div
      style={{
        position: 'absolute',
        left: '5%',
        width: '90%',
        top: `${project.style.position}%`,
        translate: `${x}px calc(-50% + ${y}px)`,
        scale,
        opacity: entry * exit,
        textAlign: 'center',
        fontFamily: project.style.fontFamily,
        fontSize: safeSize,
        lineHeight: 1.045,
        fontWeight: project.style.fontFamily === 'Bebas Neue' ? 400 : 800,
        textTransform: project.style.textCase ?? 'uppercase',
        letterSpacing: animation === 'Tracking' ? 3 + (1 - entry) * 20 : 3,
        textShadow: glitch
          ? `${3 + jitter * 0.4}px 0 #f2527266,${-3 - jitter * 0.4}px 0 #7be2ef66,0 4px 40px #080400`
          : '0 5px 40px #100700b0',
      }}
    >
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ whiteSpace: 'nowrap' }}>
          {row.map((word) => {
            const active = time * 1000 >= word.startMs && time * 1000 < word.endMs;
            const isFinal = word.id === line.at(-1)?.id;
            const progress = clamp(
              (time * 1000 - word.startMs) / Math.max(1, (word.endMs - word.startMs) * 0.65),
            );
            const content =
              animation === 'Typewriter'
                ? word.text.slice(0, Math.ceil(word.text.length * progress))
                : word.text;
            const wordAge = (time * 1000 - word.startMs) / 1000;
            const trail =
              active &&
              project.style.effects > 0 &&
              (glitch || ['Rise', 'Slide', 'Bounce'].includes(animation))
                ? clamp(1 - wordAge / 0.3) * (project.style.effects / 100) * 0.23
                : 0;
            return (
              <React.Fragment key={word.id}>
                <span
                  style={{
                    display: 'inline-block',
                    color: active || isFinal ? project.style.accent : project.style.color,
                    scale: active && animation === 'Scale' ? 1.04 : 1,
                    translate: active && animation === 'Rise' ? '0 -2px' : undefined,
                    opacity: animation === 'Typewriter' && time * 1000 < word.startMs ? 0 : 1,
                    position: 'relative',
                  }}
                >
                  {trail > 0 &&
                    [1, 2].map((lag) => (
                      <span
                        key={lag}
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          opacity: trail / lag,
                          color: glitch
                            ? lag === 1
                              ? '#7ae6ed'
                              : '#f476ab'
                            : project.style.accent,
                          translate: `${animation === 'Slide' ? -lag * 12 : glitch ? lag * 6 : 0}px ${animation === 'Slide' || glitch ? 0 : lag * 9}px`,
                          filter: `blur(${lag * 0.6}px)`,
                        }}
                      >
                        {word.text}
                      </span>
                    ))}
                  {animation === 'Typewriter' ? (
                    <>
                      <span style={{ visibility: 'hidden' }}>{word.text}</span>
                      <span style={{ position: 'absolute', left: 0, top: 0 }}>{content}</span>
                    </>
                  ) : (
                    <span style={{ position: 'relative' }}>{content}</span>
                  )}
                </span>{' '}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** One shared frame-driven composition is used by both Player and MP4 renderer. */
export const LyricVideo: React.FC<{ project: Project }> = ({ project }) => {
  useProjectFont(project);
  const frame = useCurrentFrame();
  const { fps, width: outputWidth } = useVideoConfig();
  const time = frame / fps;
  const width = project.aspect === '9:16' ? 1080 : 1920,
    height = project.aspect === '9:16' ? 1920 : 1080;
  const scene =
    project.scenes.find((item) => time >= item.start && time < item.end) ?? project.scenes[0];
  const fade = Math.round(fps * 0.35);
  return (
    <AbsoluteFill style={{ background: '#111012', overflow: 'hidden' }}>
      {project.style.customFontUrl && (
        <style>{`@font-face{font-family:'Custom font';src:url(${JSON.stringify(mediaUrl(project.style.customFontUrl))})}`}</style>
      )}
      <style>{`@font-face{font-family:'Bebas Neue';src:url('${mediaUrl('/fonts/bebas-neue.woff2')}')}@font-face{font-family:Inter;src:url('${mediaUrl('/fonts/inter.woff2')}')}`}</style>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transform: `scale(${outputWidth / width})`,
          transformOrigin: 'top left',
          color: project.style.color,
          overflow: 'hidden',
        }}
      >
        {project.scenes.length ? (
          project.scenes.map((item, index) => {
            const from = Math.max(0, Math.round(item.start * fps) - fade);
            const to = Math.round(item.end * fps) + fade;
            const opacity =
              index === 0
                ? 1
                : interpolate(
                    frame,
                    [Math.round(item.start * fps) - fade, Math.round(item.start * fps) + fade],
                    [0, 1],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                  );
            return (
              <Sequence
                key={item.id}
                from={from}
                durationInFrames={Math.max(1, to - from)}
                premountFor={fps}
                style={{ opacity }}
              >
                <SceneVisual
                  project={project}
                  scene={item}
                  globalTime={time}
                  width={width}
                  height={height}
                />
              </Sequence>
            );
          })
        ) : (
          <AbsoluteFill style={{ background: presets[0].background }} />
        )}
        <LyricType project={project} time={time} scene={scene} width={width} height={height} />
      </div>
      {project.audioUrl && <Audio src={mediaUrl(project.audioUrl)} premountFor={fps} />}
    </AbsoluteFill>
  );
};
