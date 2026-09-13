import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const testsDir = join(root, 'tests');
const files = (await readdir(testsDir))
  .filter(name => name.endsWith('.test.mjs') && name !== 'browser-layout.test.mjs')
  .sort()
  .map(name => join('tests', name));

if (!files.length) {
  console.error('No Node test files found.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('error', error => {
  console.error(error);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
