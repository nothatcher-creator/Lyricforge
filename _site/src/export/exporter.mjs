import { frameTimeUs } from '../core/time.mjs';
const map={
 '720p':{land:[1280,720],portrait:[720,1280]},'1080p':{land:[1920,1080],portrait:[1080,1920]},'1440p':{land:[2560,1440],portrait:[1440,2560]},'4k':{land:[3840,2160],portrait:[2160,3840]}
};
export function resolveResolution(label,aspect='16:9',custom){ if(label==='custom'&&custom)return{width:+custom.width,height:+custom.height}; const portrait=aspect==='9:16'||aspect==='4:5'; const base=map[label]||map['1080p']; if(aspect==='1:1'){const n=label==='720p'?720:label==='1440p'?1440:label==='4k'?2160:1080;return{width:n,height:n};} if(aspect==='4:5'){const h=base.portrait[1];return{width:Math.round(h*.8),height:h};} if(aspect==='21:9'){const h=base.land[1];return{width:Math.round(h*21/9),height:h};} return portrait?{width:base.portrait[0],height:base.portrait[1]}:{width:base.land[0],height:base.land[1]}; }
export function estimateOutputBytes(durationSec,videoBitrate,audioBitrate){return Math.round(((Number(videoBitrate)||0)+(Number(audioBitrate)||0))*Number(durationSec)/8);}
export function buildFrameTimes(durationUs,fps){const count=Math.ceil((durationUs/1_000_000)*fps);return Array.from({length:count},(_,i)=>frameTimeUs(i,fps)).filter(t=>t<durationUs);}
const MIME={mp4:['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4'],webm:['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']};
export function chooseVideoMime(isSupported,format='webm'){for(const mime of MIME[format]||MIME.webm)if(isSupported(mime))return mime;return null;}
export function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
export function exportProjectFile(project){return new Blob([JSON.stringify(project,null,2)],{type:'application/json'});}
