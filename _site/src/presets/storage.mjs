import {openDB,txPromise} from '../storage/db.mjs';
import {normalizePresetRecord} from './schema.mjs';
const FALLBACK='lyricforge:installed-presets';
const localId=id=>`${id}-local-${(globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)).slice(0,8)}`;
function readFallback(){try{return JSON.parse(globalThis.localStorage?.getItem(FALLBACK)||'[]')}catch{return[]}}
function writeFallback(rows){globalThis.localStorage?.setItem(FALLBACK,JSON.stringify(rows));}
async function all(){const db=await openDB();if(!db)return readFallback();return new Promise((resolve,reject)=>{const req=db.transaction('presets').objectStore('presets').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
export async function listInstalledPresets(){return (await all()).sort((a,b)=>String(b.installedAt||'').localeCompare(String(a.installedAt||'')));}
export async function getInstalledPreset(id){const db=await openDB();if(!db)return readFallback().find(r=>r.id===id)||null;return new Promise((resolve,reject)=>{const req=db.transaction('presets').objectStore('presets').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
export async function installPreset(record,{replace=false,source='local',sourceUrl=null}={}){let normalized=normalizePresetRecord(record);const existing=await getInstalledPreset(normalized.id);if(existing){if(replace==='local')normalized={...normalized,id:localId(normalized.id)};else if(!replace)throw new Error(`Preset ${normalized.id} is already installed.`);}const stored={...normalized,installedAt:new Date().toISOString(),source:String(source||'local').slice(0,40),sourceUrl:sourceUrl?String(sourceUrl).slice(0,2048):null};const db=await openDB();if(!db){const rows=readFallback().filter(r=>r.id!==stored.id);rows.push(stored);writeFallback(rows);return stored;}const tx=db.transaction('presets','readwrite');tx.objectStore('presets').put(stored);await txPromise(tx);return stored;}
export async function removeInstalledPreset(id){const db=await openDB();if(!db){writeFallback(readFallback().filter(r=>r.id!==id));return;}const tx=db.transaction('presets','readwrite');tx.objectStore('presets').delete(id);await txPromise(tx);}
export async function isPresetInstalled(id,version){const r=await getInstalledPreset(id);return !!r&&(!version||r.version===version);}
