import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../src/editor/selection.mjs');
const project=()=>({tracks:[{id:'t',locked:false}],clips:[
 {id:'a',type:'image',trackId:'t',locked:false,groupId:null,content:{style:{color:'#fff'}},transform:{x:.2,y:.2,scale:1,rotation:0}},
 {id:'b',type:'image',trackId:'t',locked:false,groupId:null,content:{style:{color:'#000'}},transform:{x:.4,y:.4,scale:1,rotation:0}},
 {id:'c',type:'video',trackId:'t',locked:false,groupId:null,content:{},transform:{x:.6,y:.6,scale:1,rotation:0}}
]});

test('selection set/toggle is additive and immutable',async()=>{const {setSelection,toggleSelection}=await load();const s=setSelection(['a','a']);const t=toggleSelection(s,'b');assert.deepEqual([...s],['a']);assert.deepEqual([...t],['a','b']);assert.notEqual(s,t);});
test('duplicate/group/ungroup preserve originals',async()=>{const {duplicateSelection,groupSelection,ungroupSelection}=await load();const p=project();const g=groupSelection(p,['a','b']);assert.equal(p.clips[0].groupId,null);const gid=g.clips[0].groupId;assert.match(gid,/^group_/);assert.equal(g.clips[1].groupId,gid);const u=ungroupSelection(g,['a']);assert.equal(u.clips[0].groupId,null);assert.equal(u.clips[1].groupId,null);const d=duplicateSelection(p,['a','b']);assert.equal(d.clips.length,5);assert.notEqual(d.clips[3].id,'a');});
test('locked objects reject mutation and reorder preserves selection order',async()=>{const {setLocked,reorderSelection}=await load();const p=project();p.clips[0].locked=true;assert.throws(()=>reorderSelection(p,['a'],'front'),/locked/i);const q=setLocked(p,['b'],true);assert.equal(q.clips[1].locked,true);const r=reorderSelection(project(),['a','b'],'front');assert.deepEqual(r.clips.map(x=>x.id),['c','a','b']);});
test('copy/paste style only across compatible visual types',async()=>{const {copyStyle,pasteStyle}=await load();const p=project();const clip=copyStyle(p,'a');const q=pasteStyle(p,['b'],clip);assert.equal(q.clips[1].content.style.color,'#fff');assert.throws(()=>pasteStyle(p,['c'],clip),/compatible/i);});
