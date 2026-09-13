import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject} from '../src/core/model.mjs';
import {PRESETS,applyPreset,applyPresetRecord} from '../src/render/presets.mjs';
import {factoryPresetToRecord} from '../src/presets/schema.mjs';

test('all factory presets have stable ids and adapter records',()=>{assert.ok(PRESETS.length>=53);assert.equal(new Set(PRESETS.map(p=>p.id)).size,PRESETS.length);for(const p of PRESETS){const r=factoryPresetToRecord(p);assert.equal(r.id,p.id);}});
test('factory apply delegates to record application equivalently',()=>{for(const preset of PRESETS){const p=createProject();const a=applyPreset(p,preset.id);const b=applyPresetRecord(p,factoryPresetToRecord(preset));assert.deepEqual(a.lyricStyle,b.lyricStyle);assert.deepEqual(a.background,b.background);assert.deepEqual(a.visualizer,b.visualizer);assert.deepEqual(a.videoEffects,b.videoEffects);}});
