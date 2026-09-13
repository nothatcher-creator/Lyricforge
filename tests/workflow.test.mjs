import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProject,createClip,normalizeProject} from '../src/core/model.mjs';
import {EditorState} from '../src/core/state.mjs';
import {PRESETS,applyPresetRecord} from '../src/render/presets.mjs';
import {factoryPresetToRecord,serializePreset,validatePresetRecord} from '../src/presets/schema.mjs';
import {splitClip,setClipFade,toggleKeyframeAt} from '../src/editor/timeline-tools.mjs';
import {saveProject,loadProject} from '../src/storage/db.mjs';

class MemoryStorage{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(k)}key(i){return [...this.m.keys()][i]??null}get length(){return this.m.size}}
Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});

test('downloaded preset apply edit save reopen and undo/redo preserve resolved appearance',async()=>{
  const state=new EditorState(createProject('Workflow'));
  const record=validatePresetRecord(JSON.parse(serializePreset(factoryPresetToRecord(PRESETS.find(p=>p.id==='cyberpunk')))));
  state.commit(p=>Object.assign(p,applyPresetRecord(p,record)));
  const applied=state.project.lyricStyle.activeColor;
  state.commit(p=>{p.lyricStyle.fontSize=93});
  state.undo();assert.equal(state.project.lyricStyle.fontSize,record.style.fontSize);
  state.redo();assert.equal(state.project.lyricStyle.fontSize,93);
  assert.equal(state.project.lyricStyle.activeColor,applied);
  await saveProject(state.project);const reopened=await loadProject(state.project.id);
  assert.equal(reopened.lyricStyle.activeColor,applied);assert.equal(reopened.lyricStyle.fontSize,93);
});

test('editor operations survive normalization and save reopen',async()=>{
  const p=createProject('Editor');const track=p.tracks.find(t=>t.type==='images');const c=createClip('image',track.id,0,6_000_000,{assetId:'image_1'});c.transform={...c.transform,x:.42,y:.6,scale:1.4,rotation:23,flipX:true};c.crop={left:.1,top:.05,right:.2,bottom:.1};p.clips.push(c);
  let next=splitClip(p,c.id,3_000_000);const first=next.clips.find(x=>x.startUs===0);next=setClipFade(next,first.id,{fadeInUs:400_000,fadeOutUs:300_000});next=toggleKeyframeAt(next,first.id,'opacity',500_000,.75);const normalized=normalizeProject(next);
  await saveProject(normalized);const reopened=await loadProject(normalized.id);const rc=reopened.clips.find(x=>x.id===first.id);
  assert.deepEqual(rc.crop,{left:.1,top:.05,right:.2,bottom:.1});assert.equal(rc.transform.flipX,true);assert.equal(rc.fadeInUs,400_000);assert.equal(rc.keyframes.length,1);
});

test('v0.3.7 release and offline policy include new editor and preset modules',async()=>{
  const root=new URL('../',import.meta.url),pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8')),sw=await readFile(new URL('sw.js',root),'utf8');
  assert.equal(pkg.version,'0.3.7');assert.match(sw,/lyricforge-v0\.3\.7/);
  for(const path of ['src/presets/schema.mjs','src/presets/storage.mjs','src/presets/library.mjs','src/editor/selection.mjs','src/editor/transforms.mjs','src/editor/timeline-tools.mjs','presets/catalog.json'])assert.match(sw,new RegExp(path.replace(/[./]/g,'\\$&')));
});
