import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type AlignmentStatus = {
  available: boolean;
  provider: string;
  reason?: string;
  languages: string[];
  mode: 'local' | 'external' | 'off';
  modelLoaded?: boolean;
  model?: string;
};
let managedChild: ChildProcess | null = null;
let starting = false;
let cleanupRegistered = false;
const localOrigin = () => process.env.LOCAL_ALIGNMENT_ORIGIN || 'http://127.0.0.1:8000';
export const alignmentEndpoint = () => process.env.ALIGNMENT_URL || `${localOrigin()}/align`;
export async function getAlignmentStatus(): Promise<AlignmentStatus> {
  if (process.env.ALIGNMENT_MODE === 'off')
    return {
      available: false,
      provider: 'Automatic alignment disabled',
      reason: 'Use imported timestamps or manual timing.',
      languages: [],
      mode: 'off',
    };
  const external = Boolean(process.env.ALIGNMENT_URL);
  if (external && !process.env.ALIGNMENT_HEALTH_URL)
    return {
      available: true,
      provider: 'Configured alignment service',
      languages: (process.env.ALIGNMENT_LANGUAGES || 'en')
        .split(',')
        .map((language) => language.trim())
        .filter(Boolean),
      mode: 'external',
    };
  try {
    const result = await fetch(process.env.ALIGNMENT_HEALTH_URL || `${localOrigin()}/health`, {
      signal: AbortSignal.timeout(1200),
      headers:
        process.env.ALIGNMENT_TOKEN && external
          ? { Authorization: `Bearer ${process.env.ALIGNMENT_TOKEN}` }
          : {},
    });
    if (!result.ok) throw new Error('Service unavailable');
    const data = await result.json();
    if (data.available === false)
      throw new Error(typeof data.reason === 'string' ? data.reason : 'Service is not ready');
    return {
      available: true,
      provider:
        typeof data.provider === 'string'
          ? data.provider
          : external
            ? 'Configured alignment service'
            : 'Local CPU vocal alignment',
      languages: Array.isArray(data.languages) ? data.languages : ['en'],
      mode: external ? 'external' : 'local',
      modelLoaded: data.modelLoaded,
      model: typeof data.model === 'string' ? data.model : undefined,
    };
  } catch {
    return {
      available: false,
      provider: external ? 'Configured alignment service' : 'Local CPU vocal alignment',
      reason: starting
        ? 'Starting the local alignment service…'
        : external
          ? 'The configured alignment service is unavailable.'
          : 'Run npm run setup:alignment, then restart LyricForge. Imported timestamps and manual timing work without the service.',
      languages: external ? [] : ['en'],
      mode: external ? 'external' : 'local',
    };
  }
}
export async function startManagedAlignment() {
  if (process.env.ALIGNMENT_MODE === 'off' || process.env.ALIGNMENT_URL || managedChild) return;
  if ((await getAlignmentStatus()).available) return;
  const executable =
    process.env.ALIGNMENT_PYTHON ||
    path.resolve(
      '.venv-alignment',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
  if (!existsSync(executable)) return;
  const origin = new URL(localOrigin());
  if (!['127.0.0.1', 'localhost', '::1'].includes(origin.hostname)) return;
  starting = true;
  const child = spawn(
    executable,
    [
      '-m',
      'uvicorn',
      'scripts.align_service:app',
      '--host',
      origin.hostname,
      '--port',
      origin.port || '8000',
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  managedChild = child;
  child.stdout?.on('data', (data) => process.stdout.write(`[alignment] ${data}`));
  child.stderr?.on('data', (data) => process.stderr.write(`[alignment] ${data}`));
  child.on('error', (error) => {
    starting = false;
    managedChild = null;
    console.error('Could not start alignment service:', error.message);
  });
  child.on('exit', () => {
    starting = false;
    managedChild = null;
  });
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    const stop = () => managedChild?.kill('SIGTERM');
    process.once('exit', stop);
    process.once('SIGTERM', () => {
      stop();
      process.exit(0);
    });
    process.once('SIGINT', () => {
      stop();
      process.exit(0);
    });
  }
}
