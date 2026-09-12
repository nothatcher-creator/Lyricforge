import { createLyricEvent } from '../core/model.mjs';
const uid = () => `lyric_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
function extType(type='txt'){ return type.toLowerCase().replace(/^\./,''); }
function parseSrtTime(s){ const [h,m,rest]=s.trim().replace('.',',').split(':'); const [sec,ms='0']=rest.split(','); return ((+h*3600 + +m*60 + +sec)*1_000_000)+(+ms.padEnd(3,'0').slice(0,3)*1000); }
function parseVttTime(s){ const parts=s.trim().split(':'); let h=0,m=0,rest; if(parts.length===3){h=+parts[0];m=+parts[1];rest=parts[2];}else{m=+parts[0];rest=parts[1];} const [sec,ms='0']=rest.split('.'); return ((h*3600+m*60+ +sec)*1_000_000)+(+ms.padEnd(3,'0').slice(0,3)*1000); }
function formatSrt(us, comma=true){ const ms=Math.max(0,Math.round(us/1000)); const h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60, s=Math.floor(ms/1000)%60, z=ms%1000; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${comma?',':'.'}${String(z).padStart(3,'0')}`; }
export function parseLyrics(text,type='txt'){
  type=extType(type); text=String(text??'').replace(/\r/g,'');
  if(type==='txt') return text.split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>createLyricEvent(line,i*3_000_000,(i+1)*3_000_000));
  if(type==='lrc'){
    const out=[]; for(const line of text.split('\n')){ const matches=[...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]; const lyric=line.replace(/\[[^\]]+\]/g,'').trim(); if(!lyric)continue; for(const m of matches){ const frac=(m[3]??'0'); const ms=frac.length===2?+frac*10:+frac.padEnd(3,'0').slice(0,3); const start=(+m[1]*60 + +m[2])*1_000_000+ms*1000; out.push(createLyricEvent(lyric,start,start+3_000_000)); } }
    out.sort((a,b)=>a.startUs-b.startUs); out.forEach((e,i)=>{ if(out[i+1]) e.endUs=Math.max(e.startUs+50_000,out[i+1].startUs); }); return out;
  }
  if(type==='srt' || type==='vtt'){
    const clean=text.replace(/^WEBVTT[^\n]*\n+/i,''); const blocks=clean.split(/\n\s*\n/); const out=[];
    for(const block of blocks){ const lines=block.split('\n').filter(Boolean); const timingIdx=lines.findIndex(l=>l.includes('-->')); if(timingIdx<0)continue; const [a,b]=lines[timingIdx].split('-->').map(s=>s.trim().split(/\s+/)[0]); const start=type==='srt'?parseSrtTime(a):parseVttTime(a); const end=type==='srt'?parseSrtTime(b):parseVttTime(b); const lyric=lines.slice(timingIdx+1).join('\n').replace(/<[^>]+>/g,'').trim(); if(lyric)out.push(createLyricEvent(lyric,start,end)); }
    return out;
  }
  if(type==='ass' || type==='ssa'){
    return text.split('\n').filter(l=>/^Dialogue:/i.test(l)).map(l=>{ const p=l.split(','); if(p.length<10)return null; const t=s=>{const [h,m,rest]=s.trim().split(':');return (+h*3600 + +m*60 + +rest)*1_000_000;}; return createLyricEvent(p.slice(9).join(',').replace(/\{[^}]*\}/g,'').replace(/\\N/g,'\n'),t(p[1]),t(p[2])); }).filter(Boolean);
  }
  return parseLyrics(text,'txt');
}
export function exportLyrics(events,type='txt'){
  type=extType(type); const sorted=[...events].sort((a,b)=>a.startUs-b.startUs);
  if(type==='txt')return sorted.map(e=>e.text).join('\n');
  if(type==='lrc')return sorted.map(e=>{const total=Math.round(e.startUs/10_000); const m=Math.floor(total/6000), s=Math.floor(total/100)%60, cs=total%100; return `[${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}]${e.text}`;}).join('\n');
  if(type==='vtt')return 'WEBVTT\n\n'+sorted.map((e,i)=>`${i+1}\n${formatSrt(e.startUs,false)} --> ${formatSrt(e.endUs,false)}\n${e.text}`).join('\n\n');
  if(type==='srt')return sorted.map((e,i)=>`${i+1}\n${formatSrt(e.startUs,true)} --> ${formatSrt(e.endUs,true)}\n${e.text}`).join('\n\n');
  return exportLyrics(events,'txt');
}
export function splitLyric(event,index){
  const at=Math.max(1,Math.min(event.text.length-1,index)); const splitUs=Math.round(event.startUs+(event.endUs-event.startUs)*(at/event.text.length));
  return [{...structuredClone(event),id:uid(),text:event.text.slice(0,at).trimEnd(),endUs:splitUs,words:[]},{...structuredClone(event),id:uid(),text:event.text.slice(at).trimStart(),startUs:splitUs,words:[]}];
}
export function mergeLyrics(a,b){ return {...structuredClone(a),text:`${a.text.trimEnd()} ${b.text.trimStart()}`.replace(/\s+/g,' '),endUs:Math.max(a.endUs,b.endUs),words:[...(a.words||[]),...(b.words||[])]}; }
export function tapSync(events,index,timeUs,closePrevious=true){ const next=structuredClone(events); const i=Math.max(0,Math.min(index,next.length-1)); if(closePrevious && i>0) next[i-1].endUs=Math.max(next[i-1].startUs,timeUs); next[i].startUs=timeUs; if(next[i].endUs<=timeUs) next[i].endUs=timeUs+2_000_000; return {events:next,nextIndex:Math.min(i+1,next.length-1)}; }
export function nudgeLyric(event,deltaUs,mode='both'){ const e=structuredClone(event); if(mode==='start'||mode==='both')e.startUs=Math.max(0,e.startUs+deltaUs); if(mode==='end'||mode==='both')e.endUs=Math.max(e.startUs+10_000,e.endUs+deltaUs); return e; }
