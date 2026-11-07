import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';

type AtmosphereProps = {
  effect: string;
  color: string;
  amount: number;
  energy: number;
  width: number;
  height: number;
  section: string;
};
const seed = (name: string, index: number) => random(`${name}-${index}`);
const wrap = (value: number, size: number) => ((value % size) + size) % size;

/** All scene motion is derived from the frame and seeded coordinates. */
export const Atmosphere: React.FC<AtmosphereProps> = ({
  effect,
  color,
  amount,
  energy,
  width,
  height,
  section,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const strength =
    Math.max(0, Math.min(1, amount / 100)) *
    (section === 'bridge' ? 0.65 : section === 'chorus' ? 1.15 : 1);
  const hot = effect === 'fire' || effect === 'embers' || effect === 'sparks';
  const count = effect === 'rain' ? 85 : effect === 'stars' ? 90 : effect === 'dust' ? 45 : 55;
  return (
    <AbsoluteFill
      style={{ pointerEvents: 'none', overflow: 'hidden', opacity: Math.min(1, strength) }}
    >
      {/* Slowly evolving smoke gives warm and dark scenes depth without random repainting. */}
      {(hot || effect === 'fog' || effect === 'dust') &&
        Array.from({ length: 6 }, (_, i) => {
          const x = seed('fog-x', i) * width + Math.sin(time * 0.12 + i) * width * 0.12;
          const y =
            height * (0.45 + seed('fog-y', i) * 0.5) + Math.cos(time * 0.08 + i) * height * 0.1;
          return (
            <div
              key={`fog-${i}`}
              style={{
                position: 'absolute',
                width: width * 0.7,
                height: height * 0.5,
                left: x - width * 0.35,
                top: y - height * 0.25,
                borderRadius: '50%',
                background: `radial-gradient(ellipse,${effect === 'fog' ? '#b4c5dd' : effect === 'dust' ? '#f5edc8' : color}40 0%,transparent 68%)`,
                opacity: effect === 'fog' ? 0.48 : 0.25,
                transform: `rotate(${i * 27 + Math.sin(time * 0.1) * 10}deg) scale(${1 + Math.sin(time * 0.15 + i) * 0.15})`,
                mixBlendMode: 'screen',
              }}
            />
          );
        })}
      {effect === 'fire' && (
        <>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse at 50% 115%,#ffb02c${Math.round(70 + energy * 55)
                .toString(16)
                .padStart(2, '0')} 0%,#a1241145 35%,transparent 65%)`,
              mixBlendMode: 'screen',
            }}
          />
          {Array.from({ length: 14 }, (_, i) => {
            const sway = Math.sin(time * (1 + seed('flame-speed', i)) + i) * 45;
            const size = 90 + seed('flame-size', i) * 190;
            return (
              <div
                key={`flame-${i}`}
                style={{
                  position: 'absolute',
                  left: (i / 13) * width + sway - size / 2,
                  bottom: -size * 0.45,
                  width: size,
                  height: size * (1.8 + Math.sin(time * 2 + i) * 0.25 + energy * 0.6),
                  borderRadius: '65% 35% 20% 20%',
                  background: `radial-gradient(ellipse at bottom,#ffd675a0,#ee54142b 48%,transparent 70%)`,
                  filter: 'blur(15px)',
                  rotate: `${Math.sin(time + i) * 14}deg`,
                  mixBlendMode: 'screen',
                }}
              />
            );
          })}
        </>
      )}
      {effect === 'grid' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: width * 0.27,
              top: height * 0.15,
              width: width * 0.46,
              height: width * 0.46,
              borderRadius: '50%',
              background: 'linear-gradient(#f79d5e,#de4c91 65%,#a549d040)',
              boxShadow: '0 0 100px #ed6cbd55',
              opacity: 0.5 + energy * 0.2,
              clipPath:
                'polygon(0 0,100% 0,100% 58%,0 58%,0 62%,100% 62%,100% 68%,0 68%,0 72%,100% 72%,100% 78%,0 78%,0 84%,100% 84%,100% 90%,0 90%,0 96%,100% 96%,100% 100%,0 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: width * 2,
              height: height * 1.4,
              left: -width * 0.5,
              top: height * 0.52,
              backgroundImage:
                'linear-gradient(#f27bf15c 2px,transparent 2px),linear-gradient(90deg,#bd74ff66 2px,transparent 2px)',
              backgroundSize: '100px 100px',
              backgroundPosition: `0 ${wrap(time * 90, 100)}px`,
              transform: 'perspective(600px) rotateX(62deg)',
              transformOrigin: 'center top',
              boxShadow: '0 -4px 50px #ee80f566',
            }}
          />
          <AbsoluteFill
            style={{ background: 'linear-gradient(transparent 48%,#120d2640 75%,#150b23b0)' }}
          />
        </>
      )}
      {effect === 'liquid' &&
        Array.from({ length: 7 }, (_, i) => {
          const x = width * (0.5 + Math.sin(time * 0.13 + i * 2.4) * 0.45),
            y = height * (0.5 + Math.cos(time * 0.18 + i * 1.7) * 0.45);
          const hues = ['#ee729e', '#7d6eee', '#41cbb8', '#e4ac88'];
          return (
            <div
              key={`liquid-${i}`}
              style={{
                position: 'absolute',
                left: x - width * 0.25,
                top: y - height * 0.4,
                width: width * 0.5,
                height: height * 0.8,
                borderRadius: `${40 + Math.sin(time * 0.5 + i) * 20}% ${60 + Math.cos(time * 0.4 + i) * 20}% 60% 40%`,
                background: `radial-gradient(ellipse,${hues[i % 4]}77,${hues[(i + 1) % 4]}44 40%,transparent 69%)`,
                rotate: `${time * 6 + i * 37}deg`,
                scale: 1 + energy * 0.12,
                filter: 'blur(22px)',
                mixBlendMode: 'screen',
              }}
            />
          );
        })}
      {effect === 'glitch' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 4px,#0003 4px,#0003 6px)',
              opacity: 0.45,
            }}
          />
          {Array.from({ length: 7 }, (_, i) => {
            const period = Math.floor(time * 4);
            const visible = seed(`glitch-${period}`, i) > 0.75;
            return (
              <div
                key={`glitch-${i}`}
                style={{
                  position: 'absolute',
                  left: seed('glitch-x', i) * width,
                  top: seed(`glitch-y-${period}`, i) * height,
                  width: width * (0.1 + seed('glitch-width', i) * 0.5),
                  height: 3 + seed('glitch-height', i) * 12,
                  background: i % 2 ? color : '#c1f4f2',
                  opacity: visible ? 0.08 + energy * 0.2 : 0,
                  translate: `${Math.sin(frame + i) * 30}px 0`,
                }}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: width * 0.08,
              top: height * 0.12,
              width: width * 0.84,
              height: height * 0.76,
              border: '2px solid #d4e4ac25',
              transform: `skewX(${Math.sin(time * 0.3) * 2}deg)`,
            }}
          />
        </>
      )}
      {(hot || effect === 'rain' || effect === 'stars' || effect === 'dust') &&
        Array.from({ length: count }, (_, i) => {
          const speed = seed(`${effect}-speed`, i),
            depth = 0.3 + seed(`${effect}-depth`, i) * 0.7;
          let x = seed(`${effect}-x`, i) * width,
            y = seed(`${effect}-y`, i) * height;
          let length = 2 + depth * 3,
            size = length,
            opacity = 0.2 + depth * 0.5,
            rotation = 0;
          if (hot) {
            x = wrap(
              x + Math.sin(time * 0.6 + i) * 35 + time * (effect === 'sparks' ? 65 : 12) * depth,
              width,
            );
            y = wrap(y - time * (effect === 'sparks' ? 165 : 42) * (depth + 0.3), height);
            length = effect === 'sparks' ? 14 + depth * 30 : size;
            size = effect === 'sparks' ? 2 : size;
            rotation = effect === 'sparks' ? 28 : 0;
            opacity *= 0.5 + Math.sin(time * 1.2 + i) * 0.35;
          }
          if (effect === 'rain') {
            x = wrap(x - time * 60 * depth, width);
            y = wrap(y + time * (650 + depth * 500), height);
            length = 35 + depth * 65;
            size = 1 + depth;
            opacity = 0.1 + depth * 0.22;
            rotation = 12;
          }
          if (effect === 'stars') {
            const zoom = 1 + time * 0.003 * depth;
            x = width / 2 + (x - width / 2) * zoom;
            y = height / 2 + (y - height / 2) * zoom;
            opacity = 0.2 + (0.5 + 0.5 * Math.sin(time * (0.3 + speed) + i)) * 0.65;
            size = 1 + depth * 4;
            length = size;
          }
          if (effect === 'dust') {
            x = wrap(x + time * (8 + speed * 15), width);
            y = wrap(y - time * (6 + speed * 12), height);
            size = 2 + depth * 6;
            length = size;
            opacity = 0.15 + depth * 0.35;
          }
          return (
            <div
              key={`particle-${i}`}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: size,
                height: length,
                borderRadius: effect === 'rain' ? '50%' : '50%',
                background:
                  effect === 'rain'
                    ? 'linear-gradient(transparent,#c5e1e8)'
                    : hot
                      ? '#ffc16f'
                      : effect === 'dust'
                        ? '#fff4d3'
                        : '#f3e5ff',
                opacity: opacity * (0.8 + energy * 0.35),
                rotate: `${rotation}deg`,
                boxShadow: hot
                  ? `0 0 ${depth * 16}px ${color}`
                  : effect === 'stars' && i % 7 === 0
                    ? `0 0 16px 4px ${color}88`
                    : undefined,
              }}
            />
          );
        })}
      {effect === 'stars' && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at 70% 30%,#e887e725,transparent 45%),radial-gradient(ellipse at 20% 70%,#6759f335,transparent 50%)',
            mixBlendMode: 'screen',
          }}
        />
      )}
      {effect === 'rain' && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(110deg,transparent 30%,#a7c6cd${Math.round(8 + energy * 24)
              .toString(16)
              .padStart(2, '0')} 50%,transparent 60%)`,
            translate: `${Math.sin(time * 0.2) * 90}px 0`,
          }}
        />
      )}
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 220px 50px #0007' }} />
    </AbsoluteFill>
  );
};
