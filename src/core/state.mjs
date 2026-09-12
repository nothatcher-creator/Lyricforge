import { History } from './history.mjs';
import { createProject, touchProject, createClip, createLyricEvent } from './model.mjs';
import { splitLyric, mergeLyrics, nudgeLyric } from '../lyrics/formats.mjs';

export class EditorState extends EventTarget {
  constructor(project=createProject('Untitled Project')){
    super(); this.project=project; this.history=new History(project); this.selected={lyrics:new Set(),clips:new Set(),trackId:null}; this.playheadUs=0; this.clipboard=null; this.dirty=false;
  }
  emit(kind='change'){this.dispatchEvent(new CustomEvent(kind,{detail:this}));}
  commit(mutator,{history=true}={}){const next=structuredClone(this.project);mutator(next);touchProject(next);this.project=next;if(history)this.history.push(next);this.dirty=true;this.emit();return next;}
  replace(project,{history=false,dirty=false}={}){this.project=structuredClone(project);this.history.reset(this.project);if(history)this.history.push(this.project);this.dirty=dirty;this.selected={lyrics:new Set(),clips:new Set(),trackId:null};this.playheadUs=0;this.emit();}
  undo(){if(!this.history.canUndo())return;this.project=this.history.undo();this.dirty=true;this.emit();}
  redo(){if(!this.history.canRedo())return;this.project=this.history.redo();this.dirty=true;this.emit();}
  markSaved(){this.dirty=false;this.emit('saved');}
  setPlayhead(us){this.playheadUs=Math.max(0,Math.min(this.project.durationUs||Number.MAX_SAFE_INTEGER,Math.round(us)));this.emit('playhead');}
  selectLyric(id,append=false){if(!append)this.selected.lyrics.clear();if(id){if(append&&this.selected.lyrics.has(id))this.selected.lyrics.delete(id);else this.selected.lyrics.add(id);}this.selected.clips.clear();this.emit('selection');}
  selectClip(id,append=false){if(!append)this.selected.clips.clear();if(id){if(append&&this.selected.clips.has(id))this.selected.clips.delete(id);else this.selected.clips.add(id);}this.selected.lyrics.clear();this.emit('selection');}
  addLyrics(events){this.commit(p=>{p.lyrics.push(...events);p.lyrics.sort((a,b)=>a.startUs-b.startUs);if(p.lyrics.length)p.durationUs=Math.max(p.durationUs||0,p.lyrics.at(-1).endUs);});}
  addLyric(text='New lyric',atUs=this.playheadUs){const e=createLyricEvent(text,atUs,atUs+2_000_000);this.addLyrics([e]);this.selectLyric(e.id);return e;}
  updateLyric(id,patch){this.commit(p=>{const e=p.lyrics.find(x=>x.id===id);if(e)Object.assign(e,patch);});}
  deleteSelection(){const lyrics=[...this.selected.lyrics],clips=[...this.selected.clips];if(!lyrics.length&&!clips.length)return;this.commit(p=>{p.lyrics=p.lyrics.filter(x=>!lyrics.includes(x.id));p.clips=p.clips.filter(x=>!clips.includes(x.id));});this.selected.lyrics.clear();this.selected.clips.clear();this.emit('selection');}
  duplicateSelection(){const newLyrics=[],newClips=[];this.commit(p=>{for(const id of this.selected.lyrics){const e=p.lyrics.find(x=>x.id===id);if(e){const n=structuredClone(e);n.id=`lyric_${crypto.randomUUID()}`;n.startUs+=500_000;n.endUs+=500_000;newLyrics.push(n.id);p.lyrics.push(n);}}for(const id of this.selected.clips){const c=p.clips.find(x=>x.id===id);if(c){const n=structuredClone(c);n.id=`clip_${crypto.randomUUID()}`;n.startUs+=500_000;n.endUs+=500_000;newClips.push(n.id);p.clips.push(n);}}});this.selected.lyrics=new Set(newLyrics);this.selected.clips=new Set(newClips);this.emit('selection');}
  copySelection(){this.clipboard={lyrics:this.project.lyrics.filter(e=>this.selected.lyrics.has(e.id)).map(structuredClone),clips:this.project.clips.filter(c=>this.selected.clips.has(c.id)).map(structuredClone)};}
  paste(){if(!this.clipboard)return;const nl=[],nc=[];this.commit(p=>{for(const e of this.clipboard.lyrics||[]){const n=structuredClone(e);n.id=`lyric_${crypto.randomUUID()}`;n.startUs+=1_000_000;n.endUs+=1_000_000;p.lyrics.push(n);nl.push(n.id);}for(const c of this.clipboard.clips||[]){const n=structuredClone(c);n.id=`clip_${crypto.randomUUID()}`;n.startUs+=1_000_000;n.endUs+=1_000_000;p.clips.push(n);nc.push(n.id);}});this.selected.lyrics=new Set(nl);this.selected.clips=new Set(nc);this.emit('selection');}
  addTextClip(text='Song Title'){const track=this.project.tracks.find(t=>t.type==='text');const c=createClip('text',track.id,this.playheadUs,this.playheadUs+5_000_000,{text,style:{}});this.commit(p=>p.clips.push(c));this.selectClip(c.id);return c;}
  splitSelected(){const id=[...this.selected.lyrics][0];if(!id)return;const e=this.project.lyrics.find(x=>x.id===id);if(!e)return;const idx=Math.max(1,Math.floor(e.text.length/2));const [a,b]=splitLyric(e,idx);this.commit(p=>{const i=p.lyrics.findIndex(x=>x.id===id);p.lyrics.splice(i,1,a,b);});this.selected.lyrics=new Set([b.id]);this.emit('selection');}
  mergeSelected(){const ids=[...this.selected.lyrics];if(ids.length<2)return;const ev=this.project.lyrics.filter(e=>ids.includes(e.id)).sort((a,b)=>a.startUs-b.startUs);const merged=mergeLyrics(ev[0],ev[1]);this.commit(p=>{p.lyrics=p.lyrics.filter(e=>!ids.slice(0,2).includes(e.id));p.lyrics.push(merged);p.lyrics.sort((a,b)=>a.startUs-b.startUs);});this.selected.lyrics=new Set([merged.id]);this.emit('selection');}
  nudgeSelected(deltaUs,mode='both'){const ids=this.selected.lyrics;this.commit(p=>{p.lyrics=p.lyrics.map(e=>ids.has(e.id)?nudgeLyric(e,deltaUs,mode):e);});}
  addMarker(timeUs=this.playheadUs,label='Marker'){this.commit(p=>p.markers.push({id:`marker_${crypto.randomUUID()}`,timeUs,label}));}
}
