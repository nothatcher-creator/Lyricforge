import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../src/render/presets.mjs';

const load=()=>import('../src/presets/schema.mjs');

test('factory preset round-trips through portable schema', async()=>{
  const {factoryPresetToRecord,serializePreset,normalizePresetRecord}=await load();
  const record=factoryPresetToRecord(PRESETS[0]);
  const text=serializePreset(record);
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(normalizePresetRecord(JSON.parse(text)),record);
});

test('schema strips unknown keys and permits known font references', async()=>{
  const {factoryPresetToRecord,normalizePresetRecord}=await load();
  const record=factoryPresetToRecord(PRESETS[0]);
  record.extra='<script>alert(1)</script>';
  record.style.extra='ignore';
  record.style.fontId='orbitron';
  const normalized=normalizePresetRecord(record);
  assert.equal(normalized.extra,undefined);
  assert.equal(normalized.style.extra,undefined);
  assert.equal(normalized.style.fontId,'orbitron');
});

test('schema rejects invalid signatures and executable-looking fields', async()=>{
  const {validatePresetRecord,factoryPresetToRecord}=await load();
  assert.throws(()=>validatePresetRecord({signature:'not-lyricforge'}),/preset file/i);
  const record=factoryPresetToRecord(PRESETS[0]);
  record.description='<img src=x onerror=alert(1)>';
  assert.throws(()=>validatePresetRecord(record),/unsafe|markup|executable/i);
});

test('schema rejects unsupported versions and non-objects', async()=>{
  const {validatePresetRecord,factoryPresetToRecord}=await load();
  assert.throws(()=>validatePresetRecord(null),/preset file/i);
  const record=factoryPresetToRecord(PRESETS[0]);
  record.schemaVersion=99;
  assert.throws(()=>validatePresetRecord(record),/schema/i);
});

test('numeric ranges are clamped and oversized files are rejected', async()=>{
  const {normalizePresetRecord,validatePresetRecord,factoryPresetToRecord}=await load();
  const record=factoryPresetToRecord(PRESETS[0]);
  record.style.opacity=4;
  record.style.fontSize=9999;
  record.visualizer.sensitivity=-5;
  const normalized=normalizePresetRecord(record);
  assert.equal(normalized.style.opacity,1);
  assert.ok(normalized.style.fontSize<=400);
  assert.equal(normalized.visualizer.sensitivity,.2);
  assert.throws(()=>validatePresetRecord(record,{maxBytes:10}),/large/i);
});
