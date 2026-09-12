const uid = (p='id') => `${p}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
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
    workspace:{leftTab:'media',rightTab:'properties',timelineZoom:1,snap:true,snapSources:{lyrics:true,beats:true,markers:true,playhead:true,clips:true}},
    exportSettings:{format:'webm',resolution:'1080p',fps:30,videoBitrate:8_000_000,audioBitrate:192_000,quality:.9}
  };
}
export function createWord(text,startUs,endUs,confidence=1){ return {id:uid('word'),text,startUs:Math.round(startUs),endUs:Math.round(endUs),confidence,emphasis:false}; }
export function createLyricEvent(text,startUs=0,endUs=0){
  return { id:uid('lyric'), text:String(text), startUs:Math.round(startUs), endUs:Math.round(endUs), words:[], confidence:1, sectionId:null, sectionType:'unknown', styleOverride:null, animationOverride:null, tags:[], source:{type:'manual'} };
}
export function createClip(type,trackId,startUs=0,endUs=5_000_000,content={}){
  return { id:uid('clip'), type, trackId, startUs:Math.round(startUs), endUs:Math.round(endUs), sourceInUs:0, sourceOutUs:Math.max(0,Math.round(endUs-startUs)), locked:false, visible:true, muted:false, opacity:1, transform:{x:.5,y:.5,scale:1,rotation:0}, blendMode:'source-over', effects:[], keyframes:[], content };
}
export function touchProject(project){ project.modifiedAt = new Date().toISOString(); return project; }
