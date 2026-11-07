/** Isolated, optional CPU runtime. No GPU, PyTorch, or WhisperX required. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}.`);
}
try {
  const candidates = process.env.PYTHON
    ? [process.env.PYTHON]
    : process.platform === 'win32'
      ? ['python', 'py']
      : ['python3', 'python'];
  const python = candidates.find(
    (command) => spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0,
  );
  if (!python) throw new Error('Install Python 3.10–3.12, then run this command again.');
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0)
    throw new Error('FFmpeg is required. Install ffmpeg and add it to PATH.');
  const interpreter = path.resolve(
    '.venv-alignment',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  if (!existsSync(interpreter)) run(python, ['-m', 'venv', '.venv-alignment']);
  run(interpreter, ['-m', 'pip', 'install', '-r', 'scripts/alignment-requirements.txt']);
  console.log('\nLocal CPU alignment installed. Restart npm run dev or npm start.');
  console.log('The pinned English model downloads on the first alignment and is cached.');
  console.log('Use npm run alignment:serve to run the service separately.');
} catch (error) {
  console.error(`Alignment setup failed: ${error.message}`);
  process.exitCode = 1;
}
