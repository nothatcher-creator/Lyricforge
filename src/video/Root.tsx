import { Composition } from 'remotion';
import { LyricVideo } from './Composition';
import { createDemo } from '../core/demo';
export const Root = () => (
  <Composition
    id="LyricForge"
    component={LyricVideo}
    durationInFrames={1440}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ project: createDemo() }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.ceil(props.project.duration * 30)),
      width: props.project.aspect === '9:16' ? 1080 : 1920,
      height: props.project.aspect === '9:16' ? 1920 : 1080,
    })}
  />
);
