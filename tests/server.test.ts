import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensions, isLocalAsset, validateRenderRequest } from '../server/render';
import { createApp } from '../server/index';
import type { Project } from '../src/core/types';
const project: Project = {
  id: 'test',
  name: 'Test',
  artist: 'LyricForge',
  audioUrl: '/assets/demo.wav',
  audioName: 'demo.wav',
  duration: 4,
  words: [
    {
      id: 'w',
      lineId: 'l',
      text: 'Hello',
      startMs: 0,
      endMs: 1000,
      timestampMs: 0,
      confidence: null,
      source: 'manual',
    },
  ],
  scenes: [{ id: 's', name: 'Verse', start: 0, end: 4, presetId: 'cinematic', section: 'verse' }],
  analysis: null,
  style: {
    fontFamily: 'sans-serif',
    fontSize: 100,
    color: '#fff',
    accent: '#f60',
    position: 50,
    animation: 'fade',
    effects: 0.5,
    beatReactive: true,
  },
  aspect: '16:9',
  updatedAt: 0,
};
test('render dimensions cover all requested landscape and vertical resolutions', () => {
  assert.deepEqual(dimensions('16:9', '1080p'), { width: 1920, height: 1080 });
  assert.deepEqual(dimensions('9:16', '4k'), { width: 2160, height: 3840 });
  assert.deepEqual(dimensions('16:9', '720p'), { width: 1280, height: 720 });
});
test('render media can only resolve known local files', () => {
  for (const url of [
    'https://example.com/track.mp3',
    'http://127.0.0.1/private',
    '/uploads/../../secret.mp3',
    'file:///etc/passwd',
    '/assets/other.wav',
    '/uploads/a.wav?other=1',
  ])
    assert.equal(isLocalAsset(url), false, url);
  assert.equal(isLocalAsset('/uploads/1234-abcd.wav'), true);
  assert.equal(isLocalAsset('/assets/demo.wav'), true);
});
test('render schema rejects corrupt timings, duration, media and settings', () => {
  assert.equal(validateRenderRequest({ project }).resolution, '1080p');
  assert.throws(
    () => validateRenderRequest({ project: { ...project, duration: Infinity } }),
    /duration/,
  );
  assert.throws(
    () => validateRenderRequest({ project: { ...project, audioUrl: 'https://bad.test/song.mp3' } }),
    /Upload/,
  );
  assert.throws(
    () =>
      validateRenderRequest({
        project: { ...project, words: [{ ...project.words[0], endMs: 5000 }] },
      }),
    /word/,
  );
  assert.throws(
    () =>
      validateRenderRequest({
        project: { ...project, words: [{ ...project.words[0], startMs: 1000, endMs: 500 }] },
      }),
    /word/,
  );
  assert.throws(
    () =>
      validateRenderRequest({
        project: {
          ...project,
          scenes: [{ ...project.scenes[0], background: 'http://localhost:22' }],
        },
      }),
    /Scenes/,
  );
  assert.throws(
    () =>
      validateRenderRequest({ project: { ...project, style: { ...project.style, fontSize: -1 } } }),
    /visual/,
  );
  assert.throws(() => validateRenderRequest({ project, resolution: '8k' }), /720p/);
  assert.throws(
    () =>
      validateRenderRequest({
        project: {
          ...project,
          style: { ...project.style, customFontUrl: 'https://fonts.example/font.woff2' },
        },
      }),
    /Custom fonts/,
  );
  assert.throws(
    () =>
      validateRenderRequest({
        project: { ...project, style: { ...project.style, customFontUrl: '/uploads/abcd.mp3' } },
      }),
    /Custom fonts/,
  );
  assert.throws(
    () =>
      validateRenderRequest({
        project: { ...project, style: { ...project.style, textCase: 'camel' } },
      }),
    /text case/,
  );
  assert.equal(
    validateRenderRequest({
      project: {
        ...project,
        style: { ...project.style, textCase: 'lowercase', customFontUrl: '/uploads/abcd.woff2' },
      },
    }).project.style.textCase,
    'lowercase',
  );
});
test('API reports capabilities and meaningful missing-job and invalid-render errors', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    const health = (await fetch(base + '/api/health').then((r) => r.json())) as { ok: boolean };
    assert.equal(health.ok, true);
    assert.equal((await fetch(base + '/api/render/missing')).status, 404);
    const invalid = await fetch(base + '/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: {} }),
    });
    assert.equal(invalid.status, 400);
    assert.match(((await invalid.json()) as { error: string }).error, /metadata/);
    const body = new FormData();
    body.append('file', new Blob(['hello']), 'script.exe');
    const unsupported = await fetch(base + '/api/upload', { method: 'POST', body });
    assert.equal(unsupported.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
