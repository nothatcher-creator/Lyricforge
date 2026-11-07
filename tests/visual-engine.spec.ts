import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

async function waitForFonts(page: Page) {
  await page.waitForFunction(
    () => document.fonts.status === 'loaded' && document.fonts.check('150px "Bebas Neue"'),
  );
  await page.waitForTimeout(250);
}
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('all ten procedural styles and eight typography presets render distinct deterministic frames', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await waitForFonts(page);
  mkdirSync('artifacts/visual-engine', { recursive: true });
  const styleHashes = new Set<string>();
  const animationHashes = new Set<string>();
  const report: {
    styles: { name: string; hash: string }[];
    animations: { name: string; hash: string }[];
  } = { styles: [], animations: [] };
  const cards = page.locator('.preset-card');
  await expect(cards).toHaveCount(10);
  for (let i = 0; i < 10; i++) {
    const card = cards.nth(i),
      name = await card.locator('.preset-meta strong').innerText();
    await card.click();
    await expect(page.locator('.selected-style')).toContainText(name);
    await waitForFonts(page);
    const image = await page
      .locator('.player-shell')
      .screenshot({ path: `artifacts/visual-engine/style-${i}.png` });
    const hash = digest(image);
    styleHashes.add(hash);
    report.styles.push({ name, hash });
  }
  expect(styleHashes.size).toBe(10);
  await cards.first().click();
  // At three frames into the first line every entry animation has visible motion.
  await page.locator('.word-clip').first().click();
  await page.keyboard.press('ArrowRight');
  for (const animation of [
    'Rise',
    'Fade',
    'Scale',
    'Typewriter',
    'Slide',
    'Glitch',
    'Tracking',
    'Bounce',
  ]) {
    await page.getByLabel('Text animation').selectOption(animation);
    await waitForFonts(page);
    const image = await page
      .locator('.player-shell')
      .screenshot({ path: `artifacts/visual-engine/animation-${animation.toLowerCase()}.png` });
    const hash = digest(image);
    animationHashes.add(hash);
    report.animations.push({ name: animation, hash });
    const repeat = await page.locator('.player-shell').screenshot();
    expect(digest(repeat)).toBe(hash);
  }
  expect(animationHashes.size).toBe(8);
  await page.getByLabel('Video format').selectOption('9:16');
  await waitForFonts(page);
  const canvas = page.locator('.player-shell');
  await canvas.screenshot({ path: 'artifacts/visual-engine/vertical.png' });
  const ratio = await canvas.evaluate((element) => element.clientWidth / element.clientHeight);
  expect(ratio).toBeCloseTo(9 / 16, 1);
  expect(errors).toEqual([]);
  writeFileSync('artifacts/visual-engine/report.json', JSON.stringify(report, null, 2));
});
