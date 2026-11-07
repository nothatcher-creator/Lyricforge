/** Opt-in genuine model integration; no provider routes are mocked. */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

test('real local CPU aligns supplied vocals and exports the measured cues', async ({
  page,
  request,
}) => {
  test.skip(
    process.env.ALIGNMENT_SMOKE !== '1',
    'Set ALIGNMENT_SMOKE=1 after setup:alignment to run actual model inference.',
  );
  const status = await request.get('/api/alignment/status');
  expect(status.ok()).toBe(true);
  expect((await status.json()).available).toBe(true);
  const dir = path.resolve('artifacts/real-alignment');
  mkdirSync(dir, { recursive: true });
  const phrase = 'We rise from the ashes and chase the light';
  const audio = path.join(dir, 'measured-vocals.wav'),
    lyrics = path.join(dir, 'measured-vocals.txt');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    `flite=text=${phrase}:voice=slt`,
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=110:sample_rate=16000:duration=3',
    '-filter_complex',
    '[1:a]volume=0.04[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0',
    '-ar',
    '16000',
    '-y',
    audio,
  ]);
  writeFileSync(lyrics, phrase);
  await page.goto('/');
  await page
    .locator('input[type=file][accept=".mp3,.wav,.txt,.lrc,.srt"]')
    .setInputFiles([audio, lyrics]);
  await expect(page.locator('.word-clip')).toHaveCount(9);
  await expect(page.locator('.word-clip').first()).toHaveAttribute('title', /aligned/, {
    timeout: 120000,
  });
  const words = await page
    .locator('.word-clip')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('title')));
  expect(words.every((word) => word?.includes('aligned'))).toBe(true);
  await page.locator('.word-clip').first().click();
  const measuredStart = Number(await page.getByLabel('Word start time').inputValue());
  expect(measuredStart).toBeGreaterThan(0.1);
  expect(measuredStart).toBeLessThan(0.5);
  await expect(page.getByLabel('Selected word')).toHaveValue('We');
  await expect(page.getByTestId('alignment-status')).toContainText('Vocal alignment complete');
  writeFileSync(
    path.join(dir, 'measured-cues.json'),
    JSON.stringify(
      {
        fixture:
          'Original FFmpeg/flite synthetic speech plus generated tone; actual local ONNX inference',
        words,
      },
      null,
      2,
    ),
  );
  await page.getByRole('button', { name: 'Export video', exact: true }).click();
  await page.getByLabel('Export resolution').selectOption('720p');
  await page
    .locator('.export-modal')
    .getByRole('button', { name: 'Export video', exact: false })
    .click();
  const downloadLink = page.getByRole('link', { name: 'Download MP4' });
  await expect(downloadLink).toBeVisible({ timeout: 150000 });
  const downloaded = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloaded;
  const output = path.join(dir, 'aligned-vocals.mp4');
  await download.saveAs(output);
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
  expect(probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video')).toMatchObject(
    { codec_name: 'h264', width: 1280, height: 720 },
  );
  expect(probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio')).toMatchObject(
    { codec_name: 'aac' },
  );
  writeFileSync(path.join(dir, 'export-probe.json'), JSON.stringify(probe, null, 2));
});
