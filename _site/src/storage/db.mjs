import { normalizeProject } from '../core/model.mjs';
const DB_NAME='lyricforge-db';
export const DB_VERSION=2;
let dbPromise;
export function openDB(){
  if(!('indexedDB' in globalThis)) return Promise.resolve(null);
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});if(!db.objectStoreNames.contains('presets'))db.createObjectStore('presets',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  return dbPromise;
}
export function txPromise(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export async function saveProject(project){const db=await openDB();const copy=normalizeProject(project);copy.modifiedAt=new Date().toISOString();if(!db){localStorage.setItem(`lyricforge:${copy.id}`,JSON.stringify(copy));localStorage.setItem('lyricforge:last',copy.id);return copy;}const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(copy);await txPromise(tx);localStorage.setItem('lyricforge:last',copy.id);return copy;}
export async function loadProject(id){const db=await openDB();if(!db){const s=localStorage.getItem(`lyricforge:${id}`);return s?normalizeProject(JSON.parse(s)):null;}return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(id);req.onsuccess=()=>resolve(req.result?normalizeProject(req.result):null);req.onerror=()=>reject(req.error);});}
export async function listProjects(){const db=await openDB();if(!db){return Object.keys(localStorage).filter(k=>k.startsWith('lyricforge:project_')).map(k=>normalizeProject(JSON.parse(localStorage.getItem(k)))).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt)));}return new Promise((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').getAll();req.onsuccess=()=>resolve((req.result||[]).map(normalizeProject).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt))));req.onerror=()=>reject(req.error);});}
export async function putAsset(id,blob,meta={}){const db=await openDB();const record={id,blob,meta};if(!db){throw new Error('IndexedDB is required for binary asset storage.');}const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(record);await txPromise(tx);return record;}
export async function getAsset(id){const db=await openDB();if(!db)return null;return new Promise((resolve,reject)=>{const req=db.transaction('assets').objectStore('assets').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
export async function deleteProject(id){const db=await openDB();if(!db){localStorage.removeItem(`lyricforge:${id}`);return;}const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);await txPromise(tx);}
export async function lastProject(){const id=localStorage.getItem('lyricforge:last');return id?loadProject(id):null;}
