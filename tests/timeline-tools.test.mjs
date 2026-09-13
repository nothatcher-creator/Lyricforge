import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../src/editor/timeline-tools.mjs');
const base=()=>({tracks:[{id:'v',type:'video',locked:false},{id:'l',type:'lyrics',locked:false},{id:'x',type:'video',locked:true}],clips:[
{id:'a',type:'video',trackId:'v',startUs:0,endUs:10_000_000,sourceInUs:2_000_000,sourceOutUs:12_000_000,locked:false,fadeInUs:0,fadeOutUs:0,keyframes:[],label:''},
{id:'b',type:'video',trackId:'v',startUs:12_000_000,endUs:20_000_000,sourceInUs:0,sourceOutUs:8_000_000,locked:false,fadeInUs:0,fadeOutUs:0,keyframes:[],label:''},
{id:'l1',type:'text',trackId:'l',startUs:0,endUs:5_000_000,locked:false,keyframes:[]},
{id:'x1',type:'video',trackId:'x',startUs:0,endUs:5_000_000,locked:false,keyframes:[]}
]});

test('split preserves source timing and unique ids',async()=>{const {splitClip}=await load();const p=splitClip(base(),'a',4_000_000);const parts=p.clips.filter(c=>c.trackId==='v').slice(0,2);assert.equal(parts[0].endUs,4_000_000);assert.equal(parts[0].sourceOutUs,6_000_000);assert.equal(parts[1].sourceInUs,6_000_000);assert.notEqual(parts[0].id,parts[1].id);});
test('trim clamps source and rejects invalid playhead/locked tracks',async()=>{const {trimClip,splitClip}=await load();const p=trimClip(base(),'a',{startUs:2_000_000,endUs:8_000_000});const c=p.clips.find(x=>x.id==='a');assert.equal(c.startUs,2_000_000);assert.equal(c.sourceInUs,4_000_000);assert.throws(()=>splitClip(base(),'a',0),/inside/i);assert.throws(()=>trimClip(base(),'x1',{startUs:1,endUs:4_000_000}),/locked/i);});
test('ripple delete shifts only later editable clips on affected track',async()=>{const {rippleDelete}=await load();const p=rippleDelete(base(),['a']);assert.equal(p.clips.find(c=>c.id==='b').startUs,2_000_000);assert.equal(p.clips.find(c=>c.id==='l1').startUs,0);assert.equal(p.clips.find(c=>c.id==='x1').startUs,0);});
test('fades clamp, labels update, keyframes toggle at same point',async()=>{const {setClipFade,setClipLabel,toggleKeyframeAt}=await load();let p=setClipFade(base(),'a',{fadeInUs:9_000_000,fadeOutUs:9_000_000});let c=p.clips.find(x=>x.id==='a');assert.ok(c.fadeInUs+c.fadeOutUs<=10_000_000);p=setClipLabel(p,'a','red');assert.equal(p.clips.find(x=>x.id==='a').label,'red');p=toggleKeyframeAt(p,'a','opacity',2_000_000,.5);assert.equal(p.clips.find(x=>x.id==='a').keyframes.length,1);p=toggleKeyframeAt(p,'a','opacity',2_000_000,.5);assert.equal(p.clips.find(x=>x.id==='a').keyframes.length,0);});
