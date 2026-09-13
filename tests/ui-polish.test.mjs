import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cssPath = new URL('../ui-polish.css', import.meta.url);

test('ships the LyricForge UI polish layer', () => {
  assert.equal(fs.existsSync(cssPath), true, 'ui-polish.css should exist');
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const token of ['--lf-accent', '.topbar', '.tool-rail', '.stage-wrap', '.timeline-panel', '.transport', '@media (max-width: 760px)', 'prefers-reduced-motion']) {
    assert.equal(css.includes(token), true, `missing ${token}`);
  }
});
