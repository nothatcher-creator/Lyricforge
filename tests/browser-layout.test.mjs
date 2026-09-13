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