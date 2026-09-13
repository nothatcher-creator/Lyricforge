import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

let server,chrome,port,debugPort,profile,ws,seq=0,pending=new Map(),chromeStderr='',chromeSpawnError=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});s.on('error',reject);});}
async function waitHttp(url,tries=80){for(let i=0;i<tries;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}await sleep(100);}throw new Error(`Timed out: ${url}`);}
async function waitChromeDebug(url,tries=300){for(let i=0;i<tries;i++){try{const r=await fetch(url);if(r.ok)return r;}catch{}if(chromeSpawnError)throw new Error(`Chrome spawn failed: ${chromeSpawnError.message}`);if(chrome?.exitCode!==null)throw new Error(`Chrome exited before DevTools became ready (code ${chrome.exitCode}). stderr:\n${chromeStderr||'(empty)'}`);await sleep(100);}throw new Error(`Timed out: ${url}. Chrome exitCode=${chrome?.exitCode??'running'}. stderr:\n${chromeStderr||'(empty)'}`);}
async function connectPage(){const list=await (await waitChromeDebug(`http://127.0.0.1:${debugPort}/json`)).json();const page=list.find(x=>x.type==='page');assert.ok(page?.webSocketDebuggerUrl,'Chromium page target unavailable');ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result);}});}
function cdp(method,params={}){const id=++seq;ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));}
async function evalJs(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text||'browser evaluate failed');return r.result?.value;}
async function load(t,width,height){await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/`});for(let i=0;i<100;i++){if(await evalJs(`Boolean(window.__LYRICFORGE__)`).catch(()=>false))return true;const blocked=await evalJs(`/blocked/i.test(document.body?.innerText||'') && location.protocol==='chrome-error:'`).catch(()=>false);if(blocked){t.skip('Chromium organization policy blocks localhost in this environment; run this test in CI/normal Chrome.');return false;}await sleep(80);}throw new Error('LyricForge did not boot');}
async function clickSelector(selector){const r=await evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);assert.ok(r&&r.w>0&&r.h>0,`Element not clickable: ${selector}`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',clickCount:1});}

before(async()=>{
  port=await freePort();debugPort=await freePort();profile=await mkdtemp(join(tmpdir(),'lyricforge-chrome-'));
  server=spawn(process.execPath,['tools/dev-server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  await waitHttp(`http://127.0.0.1:${port}/`);
  chrome=spawn(process.env.CHROME_BIN||'/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr?.on('data',chunk=>{chromeStderr=(chromeStderr+String(chunk)).slice(-12000);});
  chrome.on('error',error=>{chromeSpawnError=error;});
  await waitChromeDebug(`http://127.0.0.1:${debugPort}/json/version`);await connectPage();await cdp('Page.enable');await cdp('Runtime.enable');
});
after(async()=>{try{ws?.close();}catch{}chrome?.kill('SIGKILL');server?.kill('SIGKILL');await sleep(300);if(profile)await rm(profile,{recursive:true,force:true}).catch(()=>{});});

test('preset library UI is available and portrait sheet remains scrollable',async t=>{
  if(!await load(t,412,915))return;
  await evalJs(`document.querySelector('[data-mobile-tab="presets"]').click()`);
  const info=await evalJs(`(()=>{const left=document.querySelector('.left-panel');const t=document.querySelector('#leftContent').innerText;return {text:t,overflow:getComputedStyle(document.querySelector('#leftContent')).overflowY,height:left.getBoundingClientRect().height,viewport:innerHeight};})()`);
  for(const label of ['Factory','Installed','Library','Import Preset','Export Preset'])assert.match(info.text,new RegExp(label,'i'));
  assert.ok(['auto','scroll'].includes(info.overflow)||info.height<=info.viewport,'portrait preset sheet must remain scrollable/reachable');
});

test('canvas selection handles are touch-sized in portrait and timeline tools are reachable',async t=>{
  if(!await load(t,412,915))return;
  await evalJs(`(()=>{const c=window.__LYRICFORGE__.state.addTextClip('Test'); window.__LYRICFORGE__.state.selectClip(c.id); return c.id;})()`);
  const handles=await evalJs(`[...document.querySelectorAll('#canvasSelection [data-canvas-handle]')].map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,display:getComputedStyle(e).display}})`);
  assert.ok(handles.length>=5);
  for(const h of handles.filter(h=>h.display!=='none'))assert.ok(Math.min(h.w,h.h)>=44,`handle ${h.w}x${h.h} is too small`);
  await evalJs(`document.querySelector('[data-action="mobile-timeline"]').click()`);
  const text=await evalJs(`document.querySelector('.timeline-panel').innerText`);
  for(const label of ['Select','Razor','Ripple','Keyframe'])assert.match(text,new RegExp(label,'i'));
});

test('portrait media import yields back to preview and play starts imported audio',async t=>{
  if(!await load(t,412,915))return;
  await evalJs(`document.querySelector('[data-mobile-tab="media"]').click()`);await sleep(300);
  const pickerHit=await evalJs(`(()=>{const i=document.querySelector('#fileInput');window.__pickerHit=false;i.click=()=>{window.__pickerHit=true};document.querySelector('[data-left="import"]').click();return window.__pickerHit})()`);
  assert.equal(pickerHit,true,'Import media button must trigger the file input');
  const imported=await evalJs(`(async()=>{const sr=8000,n=sr/4,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/sr)*6000,true);const f=new File([b],'tone.wav',{type:'audio/wav'});await window.__LYRICFORGE__.importFiles([f]);return {master:!!window.__LYRICFORGE__.state.project.audioMasterAssetId,buffer:!!window.__LYRICFORGE__.audio.buffer,duration:window.__LYRICFORGE__.audio.durationUs(),sheetOpen:document.body.classList.contains('mobile-left-open')};})()`);
  assert.equal(imported.master,true);assert.equal(imported.buffer,true);assert.ok(imported.duration>100000);assert.equal(imported.sheetOpen,false,'Media sheet must close after a successful mobile import so preview controls are reachable');
  await clickSelector('.preview-play');await sleep(150);
  const playing=await evalJs(`({playing:window.__LYRICFORGE__.audio.playing,time:window.__LYRICFORGE__.audio.currentTimeUs()})`);
  assert.equal(playing.playing,true,'Visible preview play button must start imported audio');assert.ok(playing.time>0,'Playback time must advance');
});