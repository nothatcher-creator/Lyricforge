import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const text=async path=>readFile(new URL(path,root),'utf8');

test('preset library controls and portable preset import are present',async()=>{
  const [html,app]=await Promise.all([text('index.html'),text('src/app.mjs')]);
  assert.match(html,/\.lyricpreset/);
  for(const label of ['Factory','Installed','Library','Import Preset','Export Preset'])assert.match(app,new RegExp(label,'i'));
  assert.match(app,/presets\/catalog\.json/);
  assert.match(app,/installPreset|downloadPreset/);
});

test('canvas direct editing overlay exposes touch-friendly professional actions',async()=>{
  const [html,app]=await Promise.all([text('index.html'),text('src/app.mjs')]);
  assert.match(html,/id="canvasSelection"/);
  for(const handle of ['nw','ne','sw','se','rotate'])assert.match(html,new RegExp(`data-canvas-handle="${handle}"`));
  for(const action of ['flip-x','flip-y','duplicate','group','lock','crop'])assert.match(html,new RegExp(`data-selection-action="${action}"`));
  assert.match(app,/resizeFromHandle/);
  assert.match(app,/rotateFromPointer/);
});

test('timeline professional tools are reachable in the shell',async()=>{
  const html=await text('index.html');
  for(const action of ['timeline-select','timeline-razor','ripple-delete','toggle-keyframe'])assert.match(html,new RegExp(`data-action="${action}"`));
  assert.match(html,/id="timelineTrackHeight"/);
  assert.match(html,/data-timeline-context/);
});

test('timeline context actions support desktop context menu and mobile long press',async()=>{
  const [html,app]=await Promise.all([text('index.html'),text('src/app.mjs')]);
  assert.match(html,/id="timelineContextSheet"/);
  assert.match(html,/data-context-action="ripple-delete"/);
  assert.match(app,/contextmenu/);
  assert.match(app,/longPress|long-press|longpress/i);
});
