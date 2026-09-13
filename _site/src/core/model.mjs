const uid = (p='id') => `${p}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const clamp=(n,min,max,fallback=min)=>{n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const int=(n,f=0)=>Math.round(Number.isFinite(Number(n))?Number(n):f);
const rotation=n=>{n=Number(n)||0;return ((n+180)%360+360)%360-180;};
export const DEFAULT_TEXT_STYLE = Object.freeze({
  fontFamily:'Inter, system-ui, sans-serif', fontSize:76, fontWeight:800, italic:false, underline:false,
  textTransform:'none', letterSpacing:0, wordSpacing:0, lineHeight:1.1, align:'center',
  color:'#ffffff', gradientEnabled:false, gradientStart:'#ffffff', gradientEnd:'#ff365c', activeColor:'#ff365c', previousColor:'#a7adbd', upcomingColor:'#d7d9e0', opacity:1,
  strokeColor:'#06070b', strokeWidth:4, shadowColor:'rgba(0,0,0,.65)', shadowBlur:18, glow:0, blur:0,
  backgroundColor:'rgba(0,0,0,.18)', backgroundOpacity:0, radius:16, padding:18,
  x:0.5, y:0.72, scale:1, rotation:0, maxWidth:0.82,
  entrance:{name:'fade',durationMs:280,intensity:1}, idle:{name:'none',durationMs:1000,intensity:1}, exit:{name:'fade',durationMs:240,intensity:1},
  karaoke:'word-highlight'
});
export function createTrack(type, name){
  return { id:uid(`track_${type}`), type, name, visible:true, locked:false, muted:false, solo:false, order:0 };
}
export function createProject(name='Untitled Project'){
  const tracks = [
    createTrack('audio','Audio'), createTrack('background-video','Background Video'), createTrack('background-image','Background Image'),
    createTrack('lyrics','Lyrics'), createTrack('text','Text'), createTrack('images','Images'), createTrack('overlays','Overlays'), createTrack('effects','Effects')
  ].map((t,i)=>({...t,order:i}));
  const now = new Date().toISOString();
  return {
    id:uid('project'), name, schemaVersion:1, createdAt:now, modifiedAt:now,
    composition:{ width:1920, height:1080, fps:30, aspect:'16:9' }, durationUs:180_000_000,
    audioMasterAssetId:null, assets:[], tracks, clips:[], lyrics:[], markers:[], beats:[], fonts:[], customPresets:[],
    background:{type:'gradient',value:['#090b13','#18122d'],fit:'cover',blur:0,brightness:1,contrast:1,saturation:1,hue:0,opacity:1,vignette:0.25},
    lyricStyle:{...DEFAULT_TEXT_STYLE}, titleStyle:{...DEFAULT_TEXT_STYLE,fontSize:58,y:0.18},
    visualizer:{type:'bars',enabled:false,sensitivity:1,smoothing:.8,size:.75,y:.55,opacity:.55,color:'#ff365c'},
    videoEffects:{filmGrain:0,vhs:0,scanlines:0,rgbSplit:0,bloom:0,shake:0,strobe:0,monochrome:0,sepia:0,posterize:0,contrastCrush:0,tint:0,tintColor:'#ff3b7b',temperature:0,oldFilm:0,crt:0,chromaticAberration:0,beatPulse:0,vignette:0},
    workspace:{leftTab:'media',rightTab:'properties',timelineZoom:1,snap:true,snapSources:{lyrics:true,beats:true,markers:true,playhead:true,clips:true},canvasSnap:true,canvasZoom:1,timelineTool:'select',trackHeight:46},
    exportSettings:{format:'webm',resolution:'1080p',fps:30,videoBitrate:8_000_000,audioBitrate:192_000,quality:.9}
  };
}
export function createWord(text,startUs,endUs,confidence=1){ return {id:uid('word'),text,startUs:Math.round(startUs),endUs:Math.round(endUs),confidence,emphasis:false}; }
export function createLyricEvent(text,startUs=0,endUs=0){
  return { id:uid('lyric'), text:String(text), startUs:Math.round(startUs), endUs:Math.round(endUs), words:[], confidence:1, sectionId:null, sectionType:'unknown', styleOverride:null, animationOverride:null, tags:[], source:{type:'manual'} };
}
export function normalizeCrop(crop={}){
  const left=clamp(crop?.left,0,1,0),top=clamp(crop?.top,0,1,0);
  const right=clamp(crop?.right,0,Math.max(0,1-left),0),bottom=clamp(crop?.bottom,0,Math.max(0,1-top),0);
  return {left,top,right,bottom};
}
export function normalizeClip(input={}){
  const c=structuredClone(input||{}),startUs=Math.max(0,int(c.startUs)),endUs=Math.max(startUs+1,int(c.endUs,startUs+1)),duration=endUs-startUs;
  let fadeInUs=clamp(int(c.fadeInUs),0,duration,0),fadeOutUs=clamp(int(c.fadeOutUs),0,duration,0);
  if(fadeInUs+fadeOutUs>duration){const ratio=duration/(fadeInUs+fadeOutUs||1);fadeInUs=Math.floor(fadeInUs*ratio);fadeOutUs=duration-fadeInUs;}
  const t=c.transform||{};
  return {...c,startUs,endUs,sourceInUs:Math.max(0,int(c.sourceInUs)),sourceOutUs:Math.max(0,int(c.sourceOutUs,duration)),locked:!!c.locked,visible:c.visible!==false,muted:!!c.muted,opacity:clamp(c.opacity,0,1,1),transform:{...t,x:clamp(t.x,0,1,.5),y:clamp(t.y,0,1,.5),scale:clamp(Math.abs(Number(t.scale)||1),.01,20,1),rotation:rotation(t.rotation),flipX:!!t.flipX,flipY:!!t.flipY},crop:normalizeCrop(c.crop),fadeInUs,fadeOutUs,label:String(c.label??'').slice(0,64),groupId:c.groupId?String(c.groupId).slice(0,96):null,blendMode:c.blendMode||'source-over',effects:Array.isArray(c.effects)?c.effects:[],keyframes:Array.isArray(c.keyframes)?c.keyframes:[],content:c.content&&typeof c.content==='object'?c.content:{}};
}
export function normalizeProject(input){
  const base=createProject(input?.name||'Untitled Project'),p={...base,...structuredClone(input||{})};
  p.composition={...base.composition,...(input?.composition||{})};
  p.durationUs=Math.max(1_000_000,int(input?.durationUs,base.durationUs));
  p.tracks=Array.isArray(input?.tracks)?input.tracks.map((t,i)=>({...t,visible:t.visible!==false,locked:!!t.locked,muted:!!t.muted,solo:!!t.solo,order:Number.isFinite(t.order)?t.order:i})):base.tracks;
  p.clips=(Array.isArray(input?.clips)?input.clips:[]).map(normalizeClip);
  p.lyrics=Array.isArray(input?.lyrics)?input.lyrics:[];
  p.assets=Array.isArray(input?.assets)?input.assets:[];p.markers=Array.isArray(input?.markers)?input.markers:[];p.beats=Array.isArray(input?.beats)?input.beats:[];p.fonts=Array.isArray(input?.fonts)?input.fonts:[];p.customPresets=Array.isArray(input?.customPresets)?input.customPresets:[];
  p.background={...base.background,...(input?.background||{})};p.lyricStyle={...base.lyricStyle,...(input?.lyricStyle||{})};p.titleStyle={...base.titleStyle,...(input?.titleStyle||{})};p.visualizer={...base.visualizer,...(input?.visualizer||{})};p.videoEffects={...base.videoEffects,...(input?.videoEffects||{})};
  p.workspace={...base.workspace,...(input?.workspace||{}),snapSources:{...base.workspace.snapSources,...(input?.workspace?.snapSources||{})}};
  p.workspace.canvasSnap=input?.workspace?.canvasSnap!==false;p.workspace.canvasZoom=clamp(input?.workspace?.canvasZoom,.25,4,1);p.workspace.timelineTool=['select','razor'].includes(input?.workspace?.timelineTool)?input.workspace.timelineTool:'select';p.workspace.trackHeight=clamp(input?.workspace?.trackHeight,36,96,46);
  p.exportSettings={...base.exportSettings,...(input?.exportSettings||{})};
  return p;
}
export function createClip(type,trackId,startUs=0,endUs=5_000_000,content={}){
  return normalizeClip({ id:uid('clip'), type, trackId, startUs:Math.round(startUs), endUs:Math.round(endUs), sourceInUs:0, sourceOutUs:Math.max(0,Math.round(endUs-startUs)), locked:false, visible:true, muted:false, opacity:1, transform:{x:.5,y:.5,scale:1,rotation:0,flipX:false,flipY:false},crop:{left:0,top:0,right:0,bottom:0},fadeInUs:0,fadeOutUs:0,label:'',groupId:null,blendMode:'source-over', effects:[], keyframes:[], content });
}
export function touchProject(project){ project.modifiedAt = new Date().toISOString(); return project; }
