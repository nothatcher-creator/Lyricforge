export const PRESET_SIGNATURE='lyricforge-preset';
export const PRESET_SCHEMA_VERSION=1;
export const PRESET_MAX_BYTES=262144;
const unsafe=/(<\s*\/?\s*(script|iframe|object|embed|img|svg|style|link)|\bon\w+\s*=|javascript\s*:|data\s*:\s*text\/html)/i;
const clamp=(v,min,max,d=min)=>{v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;};
const text=(v,max=256,d='')=>String(v??d).slice(0,max);
const cleanText=(v,max=256,d='')=>{const s=text(v,max,d);if(unsafe.test(s))throw new Error('Preset contains unsafe executable markup.');return s;};
const bool=(v,d=false)=>v==null?d:!!v;
const pick=(src,defs)=>Object.fromEntries(Object.entries(defs).map(([k,fn])=>[k,fn(src?.[k])]).filter(([,v])=>v!==undefined));
const STYLE={fontId:v=>v==null?undefined:cleanText(v,80),fontFamily:v=>cleanText(v,160,'Inter, system-ui, sans-serif'),fontSize:v=>clamp(v,8,400,76),fontWeight:v=>clamp(v,100,1000,800),italic:v=>bool(v),underline:v=>bool(v),textTransform:v=>['none','uppercase','lowercase'].includes(v)?v:'none',letterSpacing:v=>clamp(v,-20,80,0),wordSpacing:v=>clamp(v,-20,80,0),lineHeight:v=>clamp(v,.5,4,1.1),align:v=>['left','center','right'].includes(v)?v:'center',color:v=>cleanText(v,64,'#ffffff'),activeColor:v=>cleanText(v,64,'#ff365c'),previousColor:v=>cleanText(v,64,'#a7adbd'),upcomingColor:v=>cleanText(v,64,'#d7d9e0'),opacity:v=>clamp(v,0,1,1),strokeColor:v=>cleanText(v,64,'#06070b'),strokeWidth:v=>clamp(v,0,40,4),shadowColor:v=>cleanText(v,96,'rgba(0,0,0,.65)'),shadowBlur:v=>clamp(v,0,100,18),glow:v=>clamp(v,0,100,0),blur:v=>clamp(v,0,50,0),backgroundColor:v=>cleanText(v,96,'rgba(0,0,0,.18)'),backgroundOpacity:v=>clamp(v,0,1,0),radius:v=>clamp(v,0,100,16),padding:v=>clamp(v,0,100,18),x:v=>clamp(v,0,1,.5),y:v=>clamp(v,0,1,.72),scale:v=>clamp(v,.05,20,1),rotation:v=>clamp(v,-180,180,0),maxWidth:v=>clamp(v,.1,1,.82),karaoke:v=>cleanText(v,80,'progressive-fill')};
const animation=(a={},fallback='fade')=>({name:cleanText(a?.name,80,fallback),durationMs:clamp(a?.durationMs,0,10000,280),intensity:clamp(a?.intensity,0,5,1)});
const background=b=>({type:['solid','gradient'].includes(b?.type)?b.type:'gradient',value:Array.isArray(b?.value)?b.value.slice(0,2).map(v=>cleanText(v,64)):cleanText(b?.value,64,'#090b13'),fit:['cover','contain','stretch'].includes(b?.fit)?b.fit:'cover',blur:clamp(b?.blur,0,30,0),brightness:clamp(b?.brightness,0,2,1),contrast:clamp(b?.contrast,0,2,1),saturation:clamp(b?.saturation,0,2,1),hue:clamp(b?.hue,-180,180,0),opacity:clamp(b?.opacity,0,1,1),vignette:clamp(b?.vignette,0,1,.25)});
const visualizer=v=>({type:cleanText(v?.type,40,'bars'),enabled:bool(v?.enabled),sensitivity:clamp(v?.sensitivity,.2,3,1),smoothing:clamp(v?.smoothing,0,1,.8),size:clamp(v?.size,.1,1,.75),y:clamp(v?.y,0,1,.55),opacity:clamp(v?.opacity,0,1,.55),color:cleanText(v?.color,64,'#ff365c')});
const EFFECT_KEYS=['filmGrain','vhs','scanlines','rgbSplit','bloom','shake','strobe','monochrome','sepia','posterize','contrastCrush','tint','temperature','oldFilm','crt','chromaticAberration','beatPulse','vignette'];
const effects=v=>Object.fromEntries([...EFFECT_KEYS.map(k=>[k,clamp(v?.[k],k==='temperature'?-1:0,1,0)]),['tintColor',cleanText(v?.tintColor,64,'#ff3b7b')]]);
export function normalizePresetRecord(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid preset file.');
  if(input.signature!==PRESET_SIGNATURE)throw new Error('Invalid preset file signature.');
  if(Number(input.schemaVersion)!==PRESET_SCHEMA_VERSION)throw new Error('Unsupported preset schema version.');
  const style=pick(input.style||{},STYLE);style.entrance=animation(input.style?.entrance,'fade');style.idle=animation(input.style?.idle,'none');style.exit=animation(input.style?.exit,'fade');
  return {signature:PRESET_SIGNATURE,schemaVersion:PRESET_SCHEMA_VERSION,id:cleanText(input.id,96),name:cleanText(input.name,120),author:cleanText(input.author,120,'LyricForge'),description:cleanText(input.description,500,''),category:cleanText(input.category,80,'Other'),tags:Array.isArray(input.tags)?input.tags.slice(0,20).map(v=>cleanText(v,40)):[],version:cleanText(input.version,32,'1.0.0'),minAppVersion:cleanText(input.minAppVersion,32,'0.3.7'),accent:cleanText(input.accent,64,style.activeColor||'#ff365c'),style,background:background(input.background||{}),visualizer:visualizer(input.visualizer||{}),videoEffects:effects(input.videoEffects||{})};
}
export function validatePresetRecord(input,{maxBytes=PRESET_MAX_BYTES}={}){
  const bytes=new TextEncoder().encode(typeof input==='string'?input:JSON.stringify(input)).byteLength;if(bytes>maxBytes)throw new Error('Preset file is too large.');
  const parsed=typeof input==='string'?JSON.parse(input):input;const normalized=normalizePresetRecord(parsed);if(!normalized.id||!normalized.name)throw new Error('Preset file is missing required fields.');return normalized;
}
export function factoryPresetToRecord(preset){
  if(!preset)throw new Error('Factory preset is required.');
  return normalizePresetRecord({signature:PRESET_SIGNATURE,schemaVersion:PRESET_SCHEMA_VERSION,id:preset.id,name:preset.name,author:'LyricForge',description:`Built-in ${preset.name} style`,category:preset.name.includes('Metal')?'Metal':'Factory',tags:[preset.name.toLowerCase()],version:'1.0.0',minAppVersion:'0.3.7',accent:preset.accent,style:{fontFamily:preset.fontFamily,fontWeight:preset.fontWeight,fontSize:76,x:.5,y:preset.placement,scale:1,rotation:0,opacity:1,color:'#ffffff',activeColor:preset.accent,previousColor:'#a7adbd',upcomingColor:'#d7d9e0',karaoke:preset.karaoke,entrance:{name:preset.entrance,durationMs:280,intensity:1},idle:{name:'none',durationMs:1000,intensity:1},exit:{name:'fade',durationMs:240,intensity:1}},background:{type:'gradient',value:[preset.background,'#06070b'],fit:'cover',blur:0,brightness:1,contrast:1,saturation:1,hue:0,opacity:1,vignette:.25},visualizer:{type:preset.visualizer,enabled:preset.visualizer!=='none',sensitivity:1,smoothing:.8,size:.75,y:.55,opacity:.55,color:preset.accent},videoEffects:preset.videoEffects});
}
export function serializePreset(record){return JSON.stringify(validatePresetRecord(record),null,2)+'\n';}
