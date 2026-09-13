import test from 'node:test';
import assert from 'node:assert/strict';
import {cropSourceRect,clipFadeOpacity,mediaClipRenderState} from '../src/render/renderer.mjs';
import {clipFadeGain} from '../src/audio/engine.mjs';

test('crop source rectangle uses normalized non-destructive crop',()=>{assert.deepEqual(cropSourceRect(1000,500,{left:.1,top:.2,right:.3,bottom:.1}),{sx:100,sy:100,sw:600,sh:350});});
test('visual fade opacity ramps at start and end',()=>{const c={startUs:0,endUs:10_000_000,fadeInUs:2_000_000,fadeOutUs:2_000_000,opacity:.8};assert.equal(clipFadeOpacity(c,0),0);assert.equal(clipFadeOpacity(c,1_000_000),.4);assert.equal(clipFadeOpacity(c,5_000_000),.8);assert.equal(clipFadeOpacity(c,9_000_000),.4);});
test('media render state carries crop flips and keyframed transform',()=>{const c={startUs:0,endUs:10_000_000,opacity:1,fadeInUs:0,fadeOutUs:0,crop:{left:.1,top:0,right:.1,bottom:0},transform:{x:.5,y:.5,scale:1,rotation:15,flipX:true,flipY:false},keyframes:[{property:'scale',timeUs:0,value:1},{property:'scale',timeUs:5_000_000,value:2}]};const s=mediaClipRenderState(c,2_500_000,1000,500,1000,500);assert.equal(s.flipX,true);assert.equal(s.rotation,15);assert.equal(s.scale,1.5);assert.deepEqual(s.source,{sx:100,sy:0,sw:800,sh:500});});
test('audio fade envelope mirrors visual fade timing',()=>{const c={startUs:0,endUs:10_000_000,fadeInUs:2_000_000,fadeOutUs:2_000_000};assert.equal(clipFadeGain(c,0),0);assert.equal(clipFadeGain(c,1_000_000),.5);assert.equal(clipFadeGain(c,5_000_000),1);assert.equal(clipFadeGain(c,9_000_000),.5);});
