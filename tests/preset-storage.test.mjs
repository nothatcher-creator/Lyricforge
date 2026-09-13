import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS} from '../src/render/presets.mjs';
import {factoryPresetToRecord} from '../src/presets/schema.mjs';

class LS{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}key(i){return [...this.m.keys()][i]??null}get length(){return this.m.size}}
function fresh(){globalThis.localStorage=new LS();delete globalThis.indexedDB;return import(`../src/presets/storage.mjs?x=${Math.random()}`)}

test('install/list/get/remove works independently of projects',async()=>{const s=await fresh();const r=factoryPresetToRecord(PRESETS[0]);await s.installPreset(r,{source:'import'});assert.equal((await s.listInstalledPresets()).length,1);assert.equal((await s.getInstalledPreset(r.id)).name,r.name);assert.equal(await s.isPresetInstalled(r.id,r.version),true);await s.removeInstalledPreset(r.id);assert.equal((await s.listInstalledPresets()).length,0);assert.equal(localStorage.getItem('lyricforge:project_x'),null);});
test('duplicate id rejects unless replace is requested',async()=>{const s=await fresh();const r=factoryPresetToRecord(PRESETS[0]);await s.installPreset(r);await assert.rejects(()=>s.installPreset(r),/already installed/i);const r2={...r,name:'Replacement',version:'1.1.0'};await s.installPreset(r2,{replace:true});assert.equal((await s.getInstalledPreset(r.id)).name,'Replacement');});
test('incompatible collision can be localized to generated id',async()=>{const s=await fresh();const r=factoryPresetToRecord(PRESETS[0]);await s.installPreset(r);const r2={...r,name:'Fork'};const stored=await s.installPreset(r2,{replace:'local'});assert.notEqual(stored.id,r.id);assert.match(stored.id,new RegExp(`^${r.id}-local-`));assert.equal((await s.listInstalledPresets()).length,2);});
