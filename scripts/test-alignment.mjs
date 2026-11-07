import { spawnSync } from 'node:child_process';
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
const result = spawnSync(
  python,
  [
    '-m',
    'unittest',
    'discover',
    '-s',
    'tests',
    '-p',
    'test_ctc_alignment.py',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: process.env },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
