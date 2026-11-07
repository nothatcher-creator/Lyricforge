import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const python =
  process.env.ALIGNMENT_PYTHON ||
  path.resolve(
    '.venv-alignment',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
if (!existsSync(python)) {
  console.error('Run npm run setup:alignment first.');
  process.exit(1);
}
const child = spawn(
  python,
  [
    '-m',
    'uvicorn',
    'scripts.align_service:app',
    '--host',
    '127.0.0.1',
    '--port',
    process.env.ALIGNMENT_PORT || '8000',
  ],
  { stdio: 'inherit', env: process.env },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => (process.exitCode = code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
