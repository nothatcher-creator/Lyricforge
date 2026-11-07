import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
async function importFixture(page: Page, audio = 'studio-test.wav') {
  await page
    .locator('input[type=file][accept=".mp3,.wav,.txt,.lrc,.srt"]')
    .setInputFiles([fixture(audio), fixture('studio-test.lrc')]);
  await expect(page.locator('.word-clip')).toHaveCount(3);
  await expect(page.getByLabel('Project name')).toHaveValue('studio-test');
  await expect(page.locator('.busy-indicator')).toHaveCount(0);
}
async function scrub(page: Page, fraction: number) {
  const ruler = page.locator('.time-ruler');
  const box = await ruler.boundingBox();
  expect(box).not.toBeNull();
  await ruler.click({ position: { x: box!.width * fraction, y: box!.height / 2 } });
}

test('desktop opens the cinematic studio and captures the editor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByLabel('Project name')).toHaveValue('Rise from the ashes');
  await expect(page.locator('.preset-card')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Export video', exact: true })).toBeVisible();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(1000);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/editor-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('WAV and timestamped lyrics import, word edits, scrub/playback, scenes, undo/redo and templates work', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Selected word')).toHaveValue('Signal');
  await expect(page.getByLabel('Word start time')).toHaveValue('0');
  await expect(page.getByLabel('Word end time')).toHaveValue('0.6');
  await page.getByLabel('Word start time').fill('0.1');
  await page.getByLabel('Word end time').fill('0.55');
  await expect(page.getByLabel('Word start time')).toHaveValue('0.1');
  await expect(page.getByLabel('Word end time')).toHaveValue('0.55');
  await scrub(page, 0.5);
  await expect(page.locator('.timecode')).toContainText('00:01:00');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await scrub(page, 0.5);
  await page.getByRole('button', { name: 'Split scene at playhead', exact: true }).click();
  await expect(page.locator('.scene-clip')).toHaveCount(2);
  await page.getByRole('button', { name: 'Styles', exact: true }).click();
  await page.locator('.preset-card').filter({ hasText: 'Afterhours' }).click();
  await expect(page.locator('.selected-style')).toContainText('Afterhours');
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)', exact: true }).click();
  await expect(page.locator('.selected-style')).toContainText('Ember');
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)', exact: true }).click();
  await expect(page.locator('.selected-style')).toContainText('Afterhours');
  page.once('dialog', (dialog) => dialog.accept('Signal custom template'));
  await page.getByRole('button', { name: 'Save as template', exact: true }).click();
  await page.getByRole('button', { name: /My templates/ }).click();
  await expect(page.locator('.template-list')).toContainText('Signal custom template');
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('studio-test');
  await expect(page.locator('.scene-clip')).toHaveCount(2);
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Word start time')).toHaveValue('0.1');
  await expect(page.getByLabel('Word end time')).toHaveValue('0.55');
});

test('MP3 uploads decode into waveform and imported lyric track', async ({ page }) => {
  await page.goto('/');
  await importFixture(page, 'studio-test.mp3');
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(page.locator('.audio-detail')).toContainText('studio-test.mp3');
  await expect(page.locator('.analysis-stats')).toContainText('Ready');
  await expect(page.locator('.wave-track svg line')).toHaveCount(1000);
});

test('UI exports a synchronized two-second MP4 with advanced effects, custom font, video and audio', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await page.locator('.preset-card').filter({ hasText: 'Afterhours' }).click();
  await page.getByLabel('Text animation').selectOption('Bounce');
  await page
    .locator('input[type=file][accept=".woff,.woff2,.ttf,.otf"]')
    .setInputFiles(path.resolve('public/fonts/bebas-neue.woff2'));
  await expect(page.getByLabel('Font family')).toHaveValue('Custom font');
  await expect(page.locator('.busy-indicator')).toHaveCount(0);
  await page
    .locator('input[type=file][accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"]')
    .setInputFiles(fixture('studio-background.mp4'));
  await expect(page.locator('.busy-indicator')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Background added');
  await page.getByRole('button', { name: 'Export video', exact: true }).click();
  await page.getByLabel('Export resolution').selectOption('720p');
  await page
    .locator('.export-modal')
    .getByRole('button', { name: 'Export video', exact: false })
    .click();
  await expect(page.locator('.render-progress')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Export video', exact: true }).click();
  await expect(page.locator('.render-progress')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download MP4' })).toBeVisible({ timeout: 150000 });
  const downloaded = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('link', { name: 'Download MP4' }).click();
  const download = await downloaded;
  const output = path.resolve('artifacts/ui-export.mp4');
  await download.saveAs(output);
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_name,codec_type,width,height,r_frame_rate',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        output,
      ],
      { encoding: 'utf8' },
    ),
  );
  const video = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  const audio = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
  expect(video).toMatchObject({
    codec_name: 'h264',
    width: 1280,
    height: 720,
    r_frame_rate: '30/1',
  });
  expect(audio.codec_name).toBe('aac');
  await expect(page.locator('.render-progress progress')).toHaveAttribute('max', '100');
  await expect(page.locator('.render-progress')).toContainText('100%');
  expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(2);
  expect(Number(probe.format.duration)).toBeLessThan(2.1);
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    '1.2',
    '-i',
    output,
    '-frames:v',
    '1',
    '-y',
    path.resolve('artifacts/ui-export-frame.png'),
  ]);
});

test('mobile studio fits the viewport and supports imports, lyrics and playback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.locator('.preset-card')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/editor-mobile.png', fullPage: true });
  await importFixture(page);
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await expect(page.locator('.lyric-list')).toContainText('Signal');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Word start time')).toBeVisible();
  await page.getByLabel('Word start time').fill('0.1');
  await expect(page.getByLabel('Word start time')).toHaveValue('0.1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Font family')).toBeVisible();
  await page.getByLabel('Font family').selectOption('Inter');
  await expect(page.getByLabel('Font family')).toHaveValue('Inter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('advanced preview produces identical pixels when seeking back to the same frame', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await page.locator('.preset-card').filter({ hasText: 'Afterhours' }).click();
  await page.getByLabel('Text animation').selectOption('Glitch');
  await page.getByLabel('Letter case').selectOption('lowercase');
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Selected word')).toHaveValue('Signal');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await scrub(page, 0.4);
  await page.waitForTimeout(200);
  const first = await page
    .locator('.player-shell')
    .screenshot({ path: 'artifacts/deterministic-frame-a.png' });
  await scrub(page, 0.75);
  await scrub(page, 0.4);
  await page.waitForTimeout(200);
  const second = await page
    .locator('.player-shell')
    .screenshot({ path: 'artifacts/deterministic-frame-b.png' });
  expect(first.equals(second)).toBe(true);
});

test('multi-file import handles lyrics selected before audio and timestamp fallbacks stay honest', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.locator('input[type=file][accept=".mp3,.wav,.txt,.lrc,.srt"]');
  await input.setInputFiles([fixture('studio-test.lrc'), fixture('studio-test.wav')]);
  await expect(page.locator('.word-clip')).toHaveCount(3);
  await expect(page.getByLabel('Project name')).toHaveValue('studio-test');
  await input.setInputFiles(fixture('studio-test.srt'));
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /imported/);
  await page.locator('.word-clip').first().click();
  await expect(page.getByLabel('Word end time')).toHaveValue('0.6');
  await input.setInputFiles(fixture('studio-test.txt'));
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /estimated/);
  await expect(
    page.locator('.small-note').filter({ hasText: 'Estimated timings need your review.' }),
  ).toBeVisible();
});

test('short UI exports honor Full HD landscape and 720p vertical dimensions', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file][accept=".mp3,.wav,.txt,.lrc,.srt"]')
    .setInputFiles([fixture('studio-short.wav'), fixture('studio-short.lrc')]);
  await expect(page.locator('.word-clip')).toHaveCount(3);
  await expect(page.getByLabel('Project name')).toHaveValue('studio-short');
  for (const [aspect, resolution, width, height, label] of [
    ['16:9', '1080p', 1920, 1080, '1080p'],
    ['9:16', '720p', 720, 1280, 'vertical'],
  ] as const) {
    await page.getByLabel('Video format').selectOption(aspect);
    await page.getByRole('button', { name: 'Export video', exact: true }).click();
    const anotherVersion = page.getByRole('button', {
      name: 'Export another version',
      exact: true,
    });
    if (await anotherVersion.isVisible()) await anotherVersion.click();
    await page.getByLabel('Export resolution').selectOption(resolution);
    await page
      .locator('.export-modal')
      .getByRole('button', { name: 'Export video', exact: false })
      .click();
    await expect(page.getByRole('link', { name: 'Download MP4' })).toBeVisible({ timeout: 150000 });
    const downloaded = page.waitForEvent('download', { timeout: 15000 });
    await page.getByRole('link', { name: 'Download MP4' }).click();
    const output = path.resolve(`artifacts/ui-export-${label}.mp4`);
    await (await downloaded).saveAs(output);
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_name,codec_type,width,height',
          '-show_entries',
          'format=duration',
          '-of',
          'json',
          output,
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(
      probe.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video'),
    ).toMatchObject({ codec_name: 'h264', width, height });
    expect(
      probe.streams.some((stream: { codec_name: string }) => stream.codec_name === 'aac'),
    ).toBe(true);
    expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(1);
    expect(Number(probe.format.duration)).toBeLessThan(1.1);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
});
