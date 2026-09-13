export const VIDEO_EFFECTS=[
  {id:'filmGrain',name:'Film Grain',group:'Texture'},
  {id:'vhs',name:'VHS Noise',group:'Retro'},
  {id:'scanlines',name:'Scanlines',group:'Retro'},
  {id:'rgbSplit',name:'RGB Split',group:'Glitch'},
  {id:'bloom',name:'Bloom',group:'Light'},
  {id:'shake',name:'Camera Shake',group:'Motion'},
  {id:'strobe',name:'Strobe',group:'Light'},
  {id:'monochrome',name:'Monochrome',group:'Color'},
  {id:'sepia',name:'Sepia',group:'Color'},
  {id:'posterize',name:'Posterize',group:'Color'},
  {id:'contrastCrush',name:'Contrast Crush',group:'Color'},
  {id:'tint',name:'Color Tint',group:'Color'},
  {id:'temperature',name:'Warm / Cold',group:'Color',signed:true},
  {id:'oldFilm',name:'Old Film',group:'Retro'},
  {id:'crt',name:'CRT',group:'Retro'},
  {id:'chromaticAberration',name:'Chromatic Aberration',group:'Glitch'},
  {id:'beatPulse',name:'Beat Pulse',group:'Music'}
];
export const DEFAULT_VIDEO_EFFECTS=Object.freeze({filmGrain:0,vhs:0,scanlines:0,rgbSplit:0,bloom:0,shake:0,strobe:0,monochrome:0,sepia:0,posterize:0,contrastCrush:0,tint:0,tintColor:'#ff3b7b',temperature:0,oldFilm:0,crt:0,chromaticAberration:0,beatPulse:0,vignette:0});
export function normalizeVideoEffects(value={}){return {...DEFAULT_VIDEO_EFFECTS,...value};}
export function compositionFilter(value={}){const f=normalizeVideoEffects(value);const contrast=1+f.contrastCrush*.85+f.posterize*.45;const saturation=Math.max(0,1-f.monochrome*.9+f.posterize*.45);const sepia=Math.min(1,f.sepia+f.oldFilm*.55);const brightness=1+Math.sin((f._timeUs||0)/1e6*17)*f.oldFilm*.025;return `grayscale(${Math.min(1,f.monochrome)}) sepia(${sepia}) contrast(${contrast}) saturate(${saturation}) brightness(${brightness})`;}
export function effectMotion(value,timeUs=0,frequencyData=new Uint8Array()){const f=normalizeVideoEffects(value),t=timeUs/1e6;const avg=frequencyData?.length?[...frequencyData].reduce((a,b)=>a+b,0)/frequencyData.length/255:0;return{x:Math.sin(t*83.1)*f.shake*10+Math.sin(t*31)*f.vhs*2,y:Math.cos(t*71.7)*f.shake*7,scale:1+avg*f.beatPulse*.06};}
function hash(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
function rgba(hex,a){const m=String(hex||'#ff3b7b').match(/^#?([0-9a-f]{6})$/i);if(!m)return`rgba(255,59,123,${a})`;const n=parseInt(m[1],16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`;}
const buffers=new WeakMap();
function effectBuffer(canvas,w,h){let rec=buffers.get(canvas);if(rec&&rec.canvas.width===w&&rec.canvas.height===h)return rec;let c=null;const doc=canvas?.ownerDocument||globalThis.document;if(doc?.createElement)c=doc.createElement('canvas');else if(globalThis.OffscreenCanvas)c=new OffscreenCanvas(w,h);if(!c)return null;c.width=w;c.height=h;rec={canvas:c,ctx:c.getContext('2d',{alpha:false})};buffers.set(canvas,rec);return rec;}
export function applyVideoEffects(ctx,value,timeUs=0,frequencyData=new Uint8Array()){
  const f=normalizeVideoEffects(value);if(!Object.entries(f).some(([k,v])=>k!=='tintColor'&&Math.abs(Number(v)||0)>.001))return;
  const w=ctx.canvas.width,h=ctx.canvas.height,rec=effectBuffer(ctx.canvas,w,h);if(!rec)return;rec.ctx.clearRect(0,0,w,h);rec.ctx.drawImage(ctx.canvas,0,0);
  const motion=effectMotion(f,timeUs,frequencyData),filter=compositionFilter({...f,_timeUs:timeUs});ctx.save();ctx.clearRect(0,0,w,h);ctx.translate(w/2+motion.x,h/2+motion.y);ctx.scale(motion.scale,motion.scale);ctx.translate(-w/2,-h/2);ctx.filter=filter;ctx.drawImage(rec.canvas,0,0);ctx.restore();
  const aberration=Math.max(f.rgbSplit,f.chromaticAberration);if(aberration>0){const d=Math.max(1,aberration*12);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.16*aberration;ctx.filter='sepia(1) saturate(9) hue-rotate(300deg)';ctx.drawImage(rec.canvas,-d,0);ctx.filter='sepia(1) saturate(9) hue-rotate(120deg)';ctx.drawImage(rec.canvas,d,0);ctx.restore();}
  if(f.bloom>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.28*f.bloom;ctx.filter=`blur(${2+f.bloom*10}px) brightness(${1.15+f.bloom*.5})`;ctx.drawImage(rec.canvas,0,0);ctx.restore();}
  if(f.tint>0||Math.abs(f.temperature)>0){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.fillStyle=f.tint>0?rgba(f.tintColor,.35*f.tint):(f.temperature>0?`rgba(255,138,61,${.3*f.temperature})`:`rgba(73,145,255,${.3*Math.abs(f.temperature)})`);ctx.fillRect(0,0,w,h);ctx.restore();}
  if(f.scanlines>0||f.crt>0){const a=.15*Math.max(f.scanlines,f.crt);ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#000';const step=Math.max(3,Math.round(5-Math.max(f.scanlines,f.crt)*2));for(let y=0;y<h;y+=step)ctx.fillRect(0,y,w,1);ctx.restore();}
  if(f.vhs>0){ctx.save();ctx.globalAlpha=.1*f.vhs;for(let i=0;i<8;i++){const y=hash(i+timeUs/33333)*h;ctx.fillStyle=i%2?'#ff4f91':'#56d7ff';ctx.fillRect((hash(i*7+timeUs/100000)*2-1)*16,y,w,1+hash(i)*4);}ctx.restore();}
  if(f.filmGrain>0||f.oldFilm>0){const amount=Math.max(f.filmGrain,f.oldFilm);ctx.save();ctx.globalAlpha=.12*amount;for(let i=0;i<Math.round(80+amount*180);i++){const q=Math.floor(timeUs/33333)*997+i;const x=hash(q)*w,y=hash(q+13)*h,s=1+hash(q+29)*3;ctx.fillStyle=hash(q+41)>.5?'#fff':'#000';ctx.fillRect(x,y,s,s);}if(f.oldFilm>.05){ctx.globalAlpha=.18*f.oldFilm;ctx.fillStyle='#fff3d2';for(let i=0;i<3;i++){const x=hash(Math.floor(timeUs/70000)+i*73)*w;ctx.fillRect(x,0,1,h);}}ctx.restore();}
  if(f.strobe>0){const pulse=Math.max(0,Math.sin(timeUs/1e6*20*Math.PI));if(pulse>.82){ctx.save();ctx.globalAlpha=(pulse-.82)/.18*.38*f.strobe;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.restore();}}
  const vignette=Math.max(f.vignette,f.crt*.45);if(vignette>0){const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${Math.min(.8,vignette*.8)})`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
}
