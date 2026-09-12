const names=['Rock','Metal','Heavy Metal','Punk','Country','Rap / Hip-Hop','Trap','Pop','Love Song','Acoustic','Indie','Lo-Fi','EDM','Synthwave','Retro','Sad','Cinematic','Dark','Chill','Minimal','Karaoke'];
const palettes=[['#ff365c','#12121a'],['#d7d7d7','#050509'],['#ff2a2a','#030303'],['#ffea00','#151515'],['#f5c16c','#302315'],['#d44cff','#100b19'],['#00f0ff','#080812'],['#ff5aa5','#25102a'],['#ff879f','#241016'],['#e5d7bd','#18140f'],['#f09d51','#142124'],['#c3b9a8','#27251f'],['#28f5d2','#071725'],['#ff3cac','#160827'],['#f5a623','#2b150d'],['#8f9bb3','#0e121a'],['#e8d7bd','#0a0b10'],['#b6b9c7','#05050a'],['#8dddc3','#101b1a'],['#ffffff','#111318'],['#ffe900','#050505']];
export const PRESETS=names.map((name,i)=>({
  id:name.toLowerCase().replace(/\s*\/\s*/g,'-').replace(/\s+/g,'-'), name, accent:palettes[i][0], background:palettes[i][1],
  fontFamily:i===1||i===2?'Impact, Haettenschweiler, sans-serif':i===20?'Arial Black, sans-serif':'Inter, system-ui, sans-serif',
  fontWeight:i===9||i===10?600:800, entrance:i===1||i===2?'glitch':i===8?'pop':i===20?'fade':'rise',
  karaoke:i===20?'word-highlight':i===12?'current-word-scale':'progressive-fill', visualizer:i===12?'spectrum':i===13?'circular':i===1?'bars':'none',
  placement:i===20?0.68:0.72
}));
export const getPreset=id=>PRESETS.find(p=>p.id===id || p.name.toLowerCase()===String(id).toLowerCase());
export const ANIMATIONS=['none','fade','pop','bounce','slide','zoom','blur-in','blur-out','typewriter','word-reveal','character-reveal','stretch','shake','pulse','flicker','glitch','neon-flicker','spin','wave','float','rise','fall'];
export function sampleAnimation(name,progress,intensity=1){ const p=Math.max(0,Math.min(1,progress)),q=1-p; switch(name){
  case'fade': return {opacity:p,x:0,y:0,scale:1,rotation:0,blur:q*8*intensity};
  case'pop':return{opacity:p,scale:.65+.35*(1-Math.cos(p*Math.PI))/2,x:0,y:0,rotation:0,blur:0};
  case'bounce':return{opacity:1,x:0,y:-Math.abs(Math.sin(p*Math.PI*2))*14*intensity*q,scale:1,rotation:0,blur:0};
  case'slide':return{opacity:p,x:q*60*intensity,y:0,scale:1,rotation:0,blur:0};
  case'zoom':return{opacity:p,x:0,y:0,scale:.65+.35*p,rotation:0,blur:0};
  case'blur-in':return{opacity:p,x:0,y:0,scale:1,rotation:0,blur:q*18*intensity};
  case'blur-out':return{opacity:1-p*.15,x:0,y:0,scale:1,rotation:0,blur:p*18*intensity};
  case'stretch':return{opacity:p,x:0,y:0,scale:.8+.2*p,scaleX:.55+.45*p,rotation:0,blur:0};
  case'shake':return{opacity:1,x:Math.sin(p*90)*7*intensity*q,y:Math.cos(p*71)*3*intensity*q,scale:1,rotation:Math.sin(p*60)*1.2*intensity*q,blur:0};
  case'pulse':return{opacity:1,x:0,y:0,scale:1+Math.sin(p*Math.PI*2)*.05*intensity,rotation:0,blur:0};
  case'flicker':return{opacity:Math.max(.18,Math.sin(p*55)*.45+.55),x:0,y:0,scale:1,rotation:0,blur:0};
  case'glitch':return{opacity:p,x:Math.sin(p*70)*5*q*intensity,y:Math.cos(p*41)*2*q,scale:1,rotation:Math.sin(p*50)*.8*q,blur:q*2};
  case'neon-flicker':return{opacity:Math.max(.3,p*(.65+.35*Math.abs(Math.sin(p*40)))),x:0,y:0,scale:1,rotation:0,blur:q*6};
  case'spin':return{opacity:p,x:0,y:0,scale:.85+.15*p,rotation:q*180*intensity,blur:0};
  case'wave':return{opacity:1,x:0,y:Math.sin(p*Math.PI*2)*8*intensity,scale:1,rotation:Math.sin(p*Math.PI*2)*1.5,blur:0};
  case'float':return{opacity:1,x:0,y:-Math.sin(p*Math.PI*2)*5*intensity,scale:1,rotation:0,blur:0};
  case'rise':return{opacity:p,x:0,y:q*40*intensity,scale:1,rotation:0,blur:0};
  case'fall':return{opacity:p,x:0,y:-q*40*intensity,scale:1,rotation:0,blur:0};
  case'typewriter':case'word-reveal':case'character-reveal':return{opacity:p,x:0,y:0,scale:1,rotation:0,blur:0,reveal:p};
  default:return{opacity:1,x:0,y:0,scale:1,rotation:0,blur:0}; } }
export function interpolateKeyframes(frames,timeUs){ if(!frames?.length)return undefined; const s=[...frames].sort((a,b)=>a.timeUs-b.timeUs); if(timeUs<=s[0].timeUs)return s[0].value; if(timeUs>=s.at(-1).timeUs)return s.at(-1).value; const i=s.findIndex(f=>f.timeUs>=timeUs); const a=s[i-1],b=s[i],t=(timeUs-a.timeUs)/(b.timeUs-a.timeUs); if(typeof a.value==='number'&&typeof b.value==='number')return a.value+(b.value-a.value)*t; return t<.5?a.value:b.value; }
export function applyPreset(project,presetId){ const p=getPreset(presetId); if(!p)return project; const next=structuredClone(project); next.lyricStyle={...next.lyricStyle,fontFamily:p.fontFamily,fontWeight:p.fontWeight,color:'#ffffff',activeColor:p.accent,entrance:{...next.lyricStyle.entrance,name:p.entrance},karaoke:p.karaoke,y:p.placement}; next.background={...next.background,type:'gradient',value:[p.background,'#06070b']}; next.visualizer={...next.visualizer,enabled:p.visualizer!=='none',type:p.visualizer,color:p.accent}; return next; }
