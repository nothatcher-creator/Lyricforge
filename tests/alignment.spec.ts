/** Browser workflow tests use an explicitly mocked alignment provider.
 * Real model inference is verified separately by the Python smoke test.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import type { Word } from '../src/core/types';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
type Outcome = 'completed' | 'failed' | 'pending';
async function mockAlignment(page: Page, initial: Outcome = 'completed') {
  const state: { outcome: Outcome; requests: number; words: Word[]; cancelled: boolean } = {
    outcome: initial,
    requests: 0,
    words: [],
    cancelled: false,
  };
  await page.route('**/api/alignment/status', (route) =>
    route.fulfill({
      json: {
        available: true,
        provider: 'Mock CTC provider (integration test)',
        reason: '',
        languages: ['en'],
        mode: 'external',
      },
    }),
  );
  await page.route('**/api/alignment-jobs**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { words: Word[] };
      state.requests++;
      state.words = body.words;
      await route.fulfill({
        status: 202,
        json: {
          id: 'mock-alignment-job',
          status: 'queued',
          progress: null,
        },
      });
      return;
    }
    if (request.method() === 'DELETE') {
      state.cancelled = true;
      await route.fulfill({
        json: { id: 'mock-alignment-job', status: 'cancelled', progress: null },
      });
      return;
    }
    const timing = [
      [120, 500],
      [700, 850],
      [1100, 1800],
    ];
    const status = state.cancelled
      ? 'cancelled'
      : state.outcome === 'pending'
        ? 'aligning'
        : state.outcome;
    await route.fulfill({
      json: {
        id: 'mock-alignment-job',
        status,
        progress: status === 'completed' ? 100 : null,
        ...(status === 'completed'
          ? {
              words: state.words.map((w, i) => ({
                ...w,
                startMs: timing[i]?.[0] ?? w.startMs,
                endMs: timing[i]?.[1] ?? w.endMs,
                confidence: 0.96,
                source: 'aligned',
                timestampMs: timing[i]?.[0] ?? null,
              })),
            }
          : {}),
        ...(status === 'failed'
          ? { error: 'The vocal model could not align these lyrics. Existing timings were kept.' }
          : {}),
      },
    });
  });
  return state;
}
async function openLyrics(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await expect(
    page.getByRole('switch', { name: 'Automatically align imported lyrics' }),
  ).toBeVisible();
}
async function importLyrics(page: Page, name = 'studio-test.txt') {
  await page
    .locator('input[type=file][accept=".mp3,.wav,.txt,.lrc,.srt"]')
    .setInputFiles([fixture('studio-test.wav'), fixture(name)]);
  await expect(page.locator('.word-clip')).toHaveCount(3);
  await expect(page.getByLabel('Project name')).toHaveValue('studio-test');
}

test('plain lyric imports automatically receive provider timings while keeping original words', async ({
  page,
}) => {
  const state = await mockAlignment(page);
  await openLyrics(page);
  await importLyrics(page);
  await expect.poll(() => state.requests).toBe(1);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /aligned/);
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Selected word')).toHaveValue('Signal');
  await expect(page.getByLabel('Word start time')).toHaveValue('0.12');
  await expect(page.getByLabel('Word end time')).toHaveValue('0.5');
  await expect(page.getByLabel('Alignment confidence')).toContainText('96%');
  expect(state.words.map((w) => w.text)).toEqual(['Signal', 'in', 'motion']);
});

test('alignment errors retain editable estimates and never mark them aligned', async ({ page }) => {
  const state = await mockAlignment(page, 'failed');
  await openLyrics(page);
  await importLyrics(page);
  await expect.poll(() => state.requests).toBe(1);
  await expect(page.getByTestId('alignment-status')).toContainText(/could not align|kept|failed/i);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /estimated/);
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Word start time')).toHaveValue('0');
});

test('automatic alignment can be disabled and exact imported timestamps are preserved', async ({
  page,
}) => {
  const state = await mockAlignment(page);
  await openLyrics(page);
  await page.getByRole('switch', { name: 'Automatically align imported lyrics' }).click();
  await expect(
    page.getByRole('switch', { name: 'Automatically align imported lyrics' }),
  ).toHaveAttribute('aria-checked', 'false');
  await importLyrics(page);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /estimated/);
  await page.waitForTimeout(400);
  expect(state.requests).toBe(0);
  await importLyrics(page, 'studio-test.lrc');
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /imported/);
  await page.waitForTimeout(400);
  expect(state.requests).toBe(0);
});

test('exact LRC imports do not automatically replace authored timing but can be aligned on request', async ({
  page,
}) => {
  const state = await mockAlignment(page);
  await openLyrics(page);
  await importLyrics(page, 'studio-test.lrc');
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /imported/);
  await page.waitForTimeout(400);
  expect(state.requests).toBe(0);
  await page.getByRole('button', { name: 'Align to vocals', exact: true }).click();
  await expect.poll(() => state.requests).toBe(1);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /aligned/);
});

test('manual timing edits made during a job are kept instead of overwritten by a stale result', async ({
  page,
}) => {
  const state = await mockAlignment(page, 'pending');
  await openLyrics(page);
  await importLyrics(page);
  await expect.poll(() => state.requests).toBe(1);
  await page.locator('.word-clip').first().click();
  await page.getByLabel('Word start time').fill('0.05');
  await expect(page.getByLabel('Word start time')).toHaveValue('0.05');
  state.outcome = 'completed';
  await expect(page.getByTestId('alignment-status')).toContainText(
    /changed|kept|discard|review|preserved/i,
  );
  await expect(page.getByLabel('Word start time')).toHaveValue('0.05');
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /manual/);
});

test('cancelling automatic alignment keeps the current timing track', async ({ page }) => {
  const state = await mockAlignment(page, 'pending');
  await openLyrics(page);
  await importLyrics(page);
  await expect.poll(() => state.requests).toBe(1);
  await page.getByRole('button', { name: 'Cancel alignment', exact: true }).click();
  await expect.poll(() => state.cancelled).toBe(true);
  await expect(page.getByTestId('alignment-status')).toContainText(/cancelled/i);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /estimated/);
});
