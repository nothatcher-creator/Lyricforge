import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,createClip,normalizeClip,normalizeProject} from '../src/core/model.mjs';

test('old clips receive editor defaults',()=>{
  const c=normalizeClip({id:'c',type:'image',trackId:'t',startUs:0,endUs:1_000_000,transform:{x:.5,y:.5,scale:1,rotation:0}});
  assert.deepEqual(c.crop,{left:0,top:0,right:0,bottom:0});
  assert.equal(c.fadeInUs,0);assert.equal(c.fadeOutUs,0);assert.equal(c.label,'');assert.equal(c.groupId,null);
  assert.equal(c.transform.flipX,false);assert.equal(c.transform.flipY,false);
});

test('crop/fades/rotation normalize safely',()=>{
  const c=normalizeClip({...createClip('video','t',0,1_000_000),crop:{left:-1,top:.2,right:2,bottom:.9},fadeInUs:900_000,fadeOutUs:900_000,transform:{x:2,y:-1,scale:-3,rotation:725,flipX:1}});
  assert.deepEqual(c.crop,{left:0,top:.2,right:1,bottom:.8});
  assert.ok(c.fadeInUs+c.fadeOutUs<=1_000_000);
  assert.equal(c.transform.rotation,5);
  assert.equal(c.transform.x,1);assert.equal(c.transform.y,0);assert.ok(c.transform.scale>0);
});

test('project normalization is backward compatible and adds workspace defaults',()=>{
  const p=createProject('x'); delete p.workspace.canvasSnap; delete p.workspace.timelineTool;
  p.clips=[{id:'c',type:'image',trackId:p.tracks[5].id,startUs:0,endUs:1_000_000,content:{}}];
  const n=normalizeProject(p);
  assert.equal(n.id,p.id);assert.equal(n.workspace.canvasSnap,true);assert.equal(n.workspace.canvasZoom,1);assert.equal(n.workspace.timelineTool,'select');assert.equal(n.workspace.trackHeight,46);
  assert.equal(n.clips[0].crop.left,0);
});
