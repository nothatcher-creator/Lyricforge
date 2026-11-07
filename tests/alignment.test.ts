import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../server/index';
import { estimateWords } from '../src/core/lyrics';

type Job = {
  id: string;
  status: 'queued' | 'aligning' | 'completed' | 'failed' | 'cancelled';
  progress: number | null;
  words?: ReturnType<typeof estimateWords>;
  error?: string;
};
const suppliedWords = () => estimateWords('Signal in motion', 2);
const requestBody = () => ({
  audioUrl: '/assets/demo.wav',
  duration: 2,
  language: 'en',
  words: suppliedWords(),
});
const result = () => ({
  words: [
    { text: 'signal', start: 0.12, end: 0.5, confidence: 0.96 },
    { text: 'IN', start: 0.7, end: 0.85, confidence: 0.93 },
    { text: 'motion!', start: 1.1, end: 1.8, confidence: 0.94 },
  ],
});
async function listen(server: Server) {
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
async function fixture(
  t: TestContext,
  options: {
    response?: unknown;
    status?: number;
    hold?: boolean;
    healthStatus?: number;
  } = {},
) {
  const oldUrl = process.env.ALIGNMENT_URL;
  const oldToken = process.env.ALIGNMENT_TOKEN;
  const oldHealth = process.env.ALIGNMENT_HEALTH_URL;
  let received = '';
  let authorization: string | undefined;
  const service = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.statusCode = options.healthStatus ?? 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          ready: true,
          available: true,
          provider: 'Test alignment provider',
          languages: ['en'],
        }),
      );
      return;
    }
    if (req.url !== '/align') {
      res.writeHead(404).end();
      return;
    }
    authorization = req.headers.authorization;
    for await (const chunk of req) received += chunk.toString();
    if (options.hold) return;
    res.writeHead(options.status ?? 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(options.response ?? result()));
  });
  const serviceUrl = await listen(service);
  process.env.ALIGNMENT_URL = serviceUrl + '/align';
  process.env.ALIGNMENT_TOKEN = 'alignment-test-token';
  if (options.healthStatus !== undefined) process.env.ALIGNMENT_HEALTH_URL = serviceUrl + '/health';
  else delete process.env.ALIGNMENT_HEALTH_URL;
  const app = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => app.once('listening', resolve));
  const address = app.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    if (oldUrl === undefined) delete process.env.ALIGNMENT_URL;
    else process.env.ALIGNMENT_URL = oldUrl;
    if (oldHealth === undefined) delete process.env.ALIGNMENT_HEALTH_URL;
    else process.env.ALIGNMENT_HEALTH_URL = oldHealth;
    if (oldToken === undefined) delete process.env.ALIGNMENT_TOKEN;
    else process.env.ALIGNMENT_TOKEN = oldToken;
    await close(app);
    await close(service);
  });
  return {
    base,
    service,
    serviceUrl,
    received: () => received,
    authorization: () => authorization,
  };
}
async function start(base: string, body: unknown = requestBody()) {
  const response = await fetch(base + '/api/alignment-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, job: (await response.json()) as Job };
}
async function terminal(base: string, id: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await fetch(base + '/api/alignment-jobs/' + id);
    assert.equal(response.status, 200);
    const job = (await response.json()) as Job;
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    await delay(25);
  }
  throw new Error('Alignment job did not finish within five seconds.');
}

test('alignment job forwards the actual audio and supplied lyrics, then retains spelling and timing provenance', async (t) => {
  const f = await fixture(t);
  const status = (await fetch(f.base + '/api/alignment/status').then((r) => r.json())) as {
    available: boolean;
  };
  assert.equal(status.available, true);
  const { response, job } = await start(f.base);
  assert.equal(response.status, 202);
  assert.ok(job.id);
  const finished = await terminal(f.base, job.id);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.progress, 100);
  assert.deepEqual(
    finished.words?.map((w) => w.text),
    ['Signal', 'in', 'motion'],
  );
  assert.deepEqual(
    finished.words?.map((w) => [w.startMs, w.endMs]),
    [
      [120, 500],
      [700, 850],
      [1100, 1800],
    ],
  );
  assert.ok(finished.words?.every((w) => w.source === 'aligned'));
  assert.match(f.received(), /name="audio"/);
  assert.match(f.received(), /RIFF/);
  assert.match(f.received(), /Signal in motion/);
  assert.equal(f.authorization(), 'Bearer alignment-test-token');
});

test('alignment rejects fabricated or partial results without changing the supplied transcript', async (t) => {
  const f = await fixture(t, { response: { words: [{ text: 'invented', start: 0.1, end: 0.5 }] } });
  const words = suppliedWords();
  const before = structuredClone(words);
  const { response, job } = await start(f.base, { ...requestBody(), words });
  assert.equal(response.status, 202);
  const finished = await terminal(f.base, job.id);
  assert.equal(finished.status, 'failed');
  assert.match(finished.error ?? '', /words|match|lyrics/i);
  assert.equal(finished.words, undefined);
  assert.deepEqual(words, before);
});

test('alignment provider failures surface as failed jobs rather than guessed synchronization', async (t) => {
  const f = await fixture(t, {
    status: 422,
    response: { detail: 'The supplied words could not be aligned.' },
  });
  const { response, job } = await start(f.base);
  assert.equal(response.status, 202);
  const finished = await terminal(f.base, job.id);
  assert.equal(finished.status, 'failed');
  assert.match(finished.error ?? '', /align|422/i);
  assert.equal(finished.words, undefined);
});

test('alignment cancellation is terminal even when the provider request is still pending', async (t) => {
  const f = await fixture(t, { hold: true });
  const { response, job } = await start(f.base);
  assert.equal(response.status, 202);
  const cancel = await fetch(f.base + '/api/alignment-jobs/' + job.id, { method: 'DELETE' });
  assert.equal(cancel.status, 200);
  const cancelled = await terminal(f.base, job.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.words, undefined);
  await delay(30);
  assert.equal((await terminal(f.base, job.id)).status, 'cancelled');
});

test('alignment API rejects invalid inputs and unknown jobs before provider processing', async (t) => {
  const f = await fixture(t);
  for (const invalid of [
    { ...requestBody(), audioUrl: 'https://example.com/song.wav' },
    { ...requestBody(), duration: -1 },
    { ...requestBody(), words: [] },
    { ...requestBody(), words: [{ text: 12 }] },
  ]) {
    const { response } = await start(f.base, invalid);
    assert.equal(response.status, 400);
  }
  assert.equal((await fetch(f.base + '/api/alignment-jobs/missing')).status, 404);
  assert.equal(
    (await fetch(f.base + '/api/alignment-jobs/missing', { method: 'DELETE' })).status,
    404,
  );
  assert.equal(f.received(), '');
});

// Optional remote health probes must reflect readiness, not just a configured URL.
test('configured health probes report unavailable alignment services honestly', async (t) => {
  const f = await fixture(t, { healthStatus: 503 });
  const response = await fetch(f.base + '/api/alignment/status');
  assert.equal(response.status, 200);
  const status = (await response.json()) as { available: boolean; reason: string };
  assert.equal(status.available, false);
  assert.match(status.reason, /unavailable|service|configured/i);
});
