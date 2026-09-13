import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../src/editor/transforms.mjs');

test('resize corners and aspect lock',async()=>{const {resizeFromHandle}=await load();const r={x:100,y:100,width:200,height:100};assert.deepEqual(resizeFromHandle(r,'se',{x:50,y:25},{aspectLocked:false}),{x:100,y:100,width:250,height:125});const a=resizeFromHandle(r,'nw',{x:50,y:20},{aspectLocked:true});assert.ok(Math.abs(a.width/a.height-2)<.001);assert.ok(a.width>0&&a.height>0);});
test('rotation wraps and flips toggle',async()=>{const {rotateFromPointer,flipTransform}=await load();const deg=rotateFromPointer({x:0,y:0},{x:0,y:-1},{startAngleDeg:0,startRotationDeg:0});assert.equal(Math.round(deg),-90);const t=flipTransform({flipX:false,flipY:false},'x');assert.equal(t.flipX,true);});
test('snap threshold scales by viewport scale',async()=>{const {snapRect}=await load();const r={x:49,y:40,width:10,height:10};const s=snapRect(r,[{axis:'x',value:50}],{thresholdPx:4,viewportScale:1});assert.equal(s.rect.x,45);const no=snapRect(r,[{axis:'x',value:60}],{thresholdPx:4,viewportScale:2});assert.equal(no.rect.x,49);});
test('crop normalizes and drag never creates negative area',async()=>{const {normalizeCrop,applyCropDrag}=await load();assert.deepEqual(normalizeCrop({left:-1,top:.1,right:2,bottom:.2}),{left:0,top:.1,right:.95,bottom:.2});const c=applyCropDrag({left:.1,top:.1,right:.1,bottom:.1},'left',{x:2,y:0});assert.ok(c.left+c.right<=.95);});
