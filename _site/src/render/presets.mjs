import { fontStack } from './web-fonts.mjs';
import { normalizeVideoEffects } from './effects.mjs';
import { factoryPresetToRecord, normalizePresetRecord } from '../presets/schema.mjs';

const themes=[
 ['Rock','#ff365c','#12121a','Bebas Neue','rise','progressive-fill','none',{}],
 ['Metal','#d7d7d7','#050509','Black Ops One','glitch','progressive-fill','bars',{filmGrain:.16,contrastCrush:.18,vignette:.3}],
 ['Heavy Metal','#ff2a2a','#030303','Black Ops One','slam','progressive-fill','bars',{filmGrain:.25,shake:.14,contrastCrush:.3,vignette:.5}],
 ['Punk','#ffea00','#151515','Bangers','jitter','progressive-fill','none',{filmGrain:.32,shake:.18,posterize:.2}],
 ['Country','#f5c16c','#302315','Roboto Condensed','rise','progressive-fill','none',{sepia:.2,filmGrain:.12}],
 ['Rap / Hip-Hop','#d44cff','#100b19','Anton','word-punch','progressive-fill','bars',{contrastCrush:.15,beatPulse:.25}],
 ['Trap','#00f0ff','#080812','Teko','slam','progressive-fill','bars',{rgbSplit:.22,beatPulse:.42,bloom:.25}],
 ['Pop','#ff5aa5','#25102a','Poppins','pop','progressive-fill','pulse',{bloom:.22,beatPulse:.2}],
 ['Love Song','#ff879f','#241016','Playfair Display','pop','progressive-fill','none',{bloom:.24,filmGrain:.05}],
 ['Acoustic','#e5d7bd','#18140f','Cormorant Garamond','fade','progressive-fill','none',{sepia:.12,filmGrain:.08}],
 ['Indie','#f09d51','#142124','Space Grotesk','float','progressive-fill','none',{filmGrain:.2,temperature:.12}],
 ['Lo-Fi','#c3b9a8','#27251f','Space Mono','fade','progressive-fill','none',{filmGrain:.35,scanlines:.08,sepia:.18}],
 ['EDM','#28f5d2','#071725','Orbitron','pulse','current-word-scale','spectrum',{bloom:.42,beatPulse:.62,rgbSplit:.12}],
 ['Synthwave','#ff3cac','#160827','Audiowide','neon-flicker','progressive-fill','circular',{bloom:.5,scanlines:.28,rgbSplit:.22,vignette:.24}],
 ['Retro','#f5a623','#2b150d','Righteous','rise','progressive-fill','none',{filmGrain:.3,sepia:.2,oldFilm:.18}],
 ['Sad','#8f9bb3','#0e121a','DM Serif Display','fade','progressive-fill','none',{monochrome:.28,vignette:.32}],
 ['Cinematic','#e8d7bd','#0a0b10','Cinzel','tracking-reveal','progressive-fill','none',{filmGrain:.08,vignette:.45,bloom:.12}],
 ['Dark','#b6b9c7','#05050a','Unbounded','ghost-trail','progressive-fill','none',{monochrome:.2,contrastCrush:.28,vignette:.55}],
 ['Chill','#8dddc3','#101b1a','Montserrat','float','progressive-fill','pulse',{bloom:.12,beatPulse:.12}],
 ['Minimal','#ffffff','#111318','Space Grotesk','fade','progressive-fill','none',{}],
 ['Karaoke','#ffe900','#050505','Arial Black','fade','word-highlight','none',{vignette:.18}],
 ['Nu Metal','#c8ff32','#080a08','Russo One','jitter','current-word-scale','bars',{contrastCrush:.32,shake:.18,filmGrain:.2,rgbSplit:.1}],
 ['Death Metal','#a9b0aa','#020303','Unbounded','slam','progressive-fill','bars',{monochrome:.35,contrastCrush:.48,shake:.22,filmGrain:.32,vignette:.58}],
 ['Metalcore','#ff3d52','#06070a','Barlow Condensed','word-punch','current-word-scale','bars',{shake:.24,beatPulse:.35,contrastCrush:.24,bloom:.08}],
 ['Grunge','#d4c7a2','#16130f','Permanent Marker','jitter','progressive-fill','none',{filmGrain:.52,sepia:.24,oldFilm:.18}],
 ['Emo','#ff4d9c','#08070c','Oswald','ghost-trail','progressive-fill','none',{monochrome:.16,bloom:.18,vignette:.42}],
 ['Pop Punk','#ff3b65','#121218','Bangers','elastic-pop','current-word-scale','bars',{shake:.1,filmGrain:.12,beatPulse:.2}],
 ['Classic Rock','#e4b76d','#21140d','Bebas Neue','rise','progressive-fill','bars',{sepia:.14,filmGrain:.18,vignette:.22}],
 ['Psychedelic','#d8ff48','#230b3b','Righteous','wobble','progressive-fill','circular',{rgbSplit:.42,bloom:.42,chromaticAberration:.34,posterize:.18}],
 ['Boom Bap','#f4c64e','#19140b','Anton','word-punch','current-word-scale','bars',{filmGrain:.28,beatPulse:.3,contrastCrush:.12}],
 ['Drill','#a6d7ff','#05070b','Teko','slam','current-word-scale','bars',{monochrome:.22,shake:.28,contrastCrush:.38,rgbSplit:.15}],
 ['Phonk','#ff4444','#090606','Russo One','chromatic-glitch','current-word-scale','bars',{vhs:.45,scanlines:.28,rgbSplit:.48,contrastCrush:.25,beatPulse:.35}],
 ['R&B','#d99bff','#140d1b','Cormorant Garamond','float','progressive-fill','pulse',{bloom:.3,beatPulse:.12,vignette:.18}],
 ['Soul','#f0b56e','#24140e','DM Serif Display','rise','progressive-fill','none',{sepia:.2,filmGrain:.12,bloom:.1}],
 ['Funk','#ffd83d','#2a0719','Bangers','wobble','current-word-scale','bars',{posterize:.26,beatPulse:.32,bloom:.16}],
 ['Disco','#ff63e6','#140521','Righteous','elastic-pop','current-word-scale','circular',{bloom:.46,rgbSplit:.18,beatPulse:.48}],
 ['Vaporwave','#62e8ff','#31123d','Audiowide','float','progressive-fill','circular',{vhs:.22,scanlines:.32,rgbSplit:.3,bloom:.32}],
 ['Cyberpunk','#00f7ff','#05070f','Orbitron','chromatic-glitch','current-word-scale','spectrum',{rgbSplit:.5,scanlines:.42,bloom:.52,chromaticAberration:.32,contrastCrush:.15}],
 ['Gothic','#ddd3e9','#09070c','Cinzel','ghost-trail','progressive-fill','none',{monochrome:.3,vignette:.6,filmGrain:.12}],
 ['Horror','#ff3030','#020202','Creepster','flicker','progressive-fill','none',{shake:.2,strobe:.14,filmGrain:.42,contrastCrush:.4,vignette:.65}],
 ['Dreamy','#b7c9ff','#15152b','Cormorant Garamond','float','progressive-fill','pulse',{bloom:.5,beatPulse:.08,vignette:.18}],
 ['Space','#89b8ff','#020713','Orbitron','tracking-reveal','progressive-fill','circular',{bloom:.34,beatPulse:.16,vignette:.34}],
 ['Anime','#ff5f9e','#181129','Bangers','elastic-pop','current-word-scale','bars',{bloom:.2,posterize:.2,beatPulse:.18}],
 ['Y2K','#6ef7ff','#d51a7c','Audiowide','pop','current-word-scale','pulse',{bloom:.4,rgbSplit:.2,posterize:.18}],
 ['Vintage Film','#e9d1a1','#2d2118','Playfair Display','fade','progressive-fill','none',{oldFilm:.52,filmGrain:.46,sepia:.42,vignette:.46}],
 ['Western','#e5bc73','#36200e','Roboto Condensed','rise','progressive-fill','none',{sepia:.42,filmGrain:.26,vignette:.35}],
 ['Gospel','#ffd96f','#15111f','Cinzel','rise','progressive-fill','pulse',{bloom:.28,beatPulse:.14}],
 ['Christmas','#ff4054','#10301f','Playfair Display','pop','progressive-fill','none',{bloom:.18,filmGrain:.06}],
 ['Wedding','#fff0f5','#271824','Cormorant Garamond','fade','progressive-fill','none',{bloom:.32,filmGrain:.05,vignette:.16}],
 ['Motivational','#ffbd3b','#17130b','Anton','slam','current-word-scale','bars',{beatPulse:.3,bloom:.12,contrastCrush:.12}],
 ['Documentary','#f1eee5','#111315','Roboto Condensed','fade','progressive-fill','none',{monochrome:.2,filmGrain:.1,vignette:.18}],
 ['Aggressive Karaoke','#ff3131','#030303','Anton','word-punch','word-highlight','bars',{shake:.12,beatPulse:.3,contrastCrush:.2}],
 ['Minimal Karaoke','#ffffff','#090a0d','Montserrat','fade','word-highlight','none',{vignette:.08}]
];
const idFor=name=>name.toLowerCase().replace(/\s*\/\s*/g,'-').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const PRESETS=themes.map(([name,accent,background,font,entrance,karaoke,visualizer,videoEffects])=>({id:idFor(name),name,accent,background,fontFamily:fontStack(font),fontWeight:['Cormorant Garamond','Playfair Display','DM Serif Display','Cinzel'].includes(font)?600:800,entrance,karaoke,visualizer,placement:name.includes('Karaoke')?.68:.72,videoEffects:normalizeVideoEffects(videoEffects)}));
export const getPreset=id=>PRESETS.find(p=>p.id===id || p.name.toLowerCase()===String(id).toLowerCase());
export const ANIMATIONS=['none','fade','pop','bounce','slide','zoom','blur-in','blur-out','typewriter','word-reveal','character-reveal','stretch','shake','pulse','flicker','glitch','neon-flicker','spin','wave','float','rise','fall','chromatic-glitch','elastic-pop','slam','wobble','jitter','word-punch','tracking-reveal','ghost-trail','character-cascade'];
export const TEXT_EFFECT_PRESETS=[['chromatic-glitch','Chromatic Glitch'],['elastic-pop','Elastic Pop'],['slam','Slam'],['wobble','Wobble'],['jitter','Jitter'],['word-punch','Word Punch'],['tracking-reveal','Tracking Reveal'],['ghost-trail','Ghost Trail'],['character-cascade','Character Cascade'],['neon-flicker','Neon Flicker'],['typewriter','Typewriter'],['wave','Wave'],['shake','Shake'],['blur-in','Blur Reveal'],['bounce','Bounce'],['pulse','Pulse']].map(([id,name])=>({id,name}));
export function sampleAnimation(name,progress,intensity=1){ const p=Math.max(0,Math.min(1,progress)),q=1-p; switch(name){
  case'fade': return {opacity:p,x:0,y:0,scale:1,rotation:0,blur:q*8*intensity};
  case'pop':return{opacity:p,scale:.65+.35*(1-Math.cos(p*Math.PI))/2,x:0,y:0,rotation:0,blur:0};
  case'elastic-pop':return{opacity:p,scale:.55+.45*p+Math.sin(p*Math.PI*3)*.18*q,x:0,y:0,rotation:0,blur:0};
  case'slam':return{opacity:p,scale:1.45-.45*p,x:0,y:-q*70*intensity,rotation:Math.sin(p*Math.PI)*-2,blur:q*3};
  case'bounce':return{opacity:1,x:0,y:-Math.abs(Math.sin(p*Math.PI*2))*14*intensity*q,scale:1,rotation:0,blur:0};
  case'slide':return{opacity:p,x:q*60*intensity,y:0,scale:1,rotation:0,blur:0};
  case'zoom':return{opacity:p,x:0,y:0,scale:.65+.35*p,rotation:0,blur:0};
  case'blur-in':return{opacity:p,x:0,y:0,scale:1,rotation:0,blur:q*18*intensity};
  case'blur-out':return{opacity:1-p*.15,x:0,y:0,scale:1,rotation:0,blur:p*18*intensity};
  case'stretch':return{opacity:p,x:0,y:0,scale:.8+.2*p,scaleX:.55+.45*p,rotation:0,blur:0};
  case'shake':case'jitter':return{opacity:1,x:Math.sin(p*(name==='jitter'?150:90))*7*intensity*q,y:Math.cos(p*(name==='jitter'?131:71))*3*intensity*q,scale:1,rotation:Math.sin(p*60)*1.2*intensity*q,blur:0};
  case'wobble':return{opacity:1,x:Math.sin(p*Math.PI*4)*5*intensity,y:0,scale:1,rotation:Math.sin(p*Math.PI*4)*4*intensity,blur:0};
  case'pulse':case'word-punch':return{opacity:1,x:0,y:0,scale:1+Math.sin(p*Math.PI*2)*(name==='word-punch'?.09:.05)*intensity,rotation:0,blur:0};
  case'flicker':return{opacity:Math.max(.18,Math.sin(p*55)*.45+.55),x:0,y:0,scale:1,rotation:0,blur:0};
  case'glitch':case'chromatic-glitch':return{opacity:p,x:Math.sin(p*(name==='chromatic-glitch'?110:70))*7*q*intensity,y:Math.cos(p*41)*2*q,scale:1,rotation:Math.sin(p*50)*.8*q,blur:q*2};
  case'neon-flicker':return{opacity:Math.max(.3,p*(.65+.35*Math.abs(Math.sin(p*40)))),x:0,y:0,scale:1,rotation:0,blur:q*6};
  case'spin':return{opacity:p,x:0,y:0,scale:.85+.15*p,rotation:q*180*intensity,blur:0};
  case'wave':return{opacity:1,x:0,y:Math.sin(p*Math.PI*2)*8*intensity,scale:1,rotation:Math.sin(p*Math.PI*2)*1.5,blur:0};
  case'float':return{opacity:1,x:0,y:-Math.sin(p*Math.PI*2)*5*intensity,scale:1,rotation:0,blur:0};
  case'rise':return{opacity:p,x:0,y:q*40*intensity,scale:1,rotation:0,blur:0};
  case'fall':return{opacity:p,x:0,y:-q*40*intensity,scale:1,rotation:0,blur:0};
  case'ghost-trail':return{opacity:.45+.55*p,x:-q*18*intensity,y:0,scale:1,rotation:0,blur:q*12};
  case'tracking-reveal':return{opacity:p,x:0,y:0,scale:.92+.08*p,rotation:0,blur:q*4,reveal:p,tracking:q*12};
  case'typewriter':case'word-reveal':case'character-reveal':case'character-cascade':return{opacity:p,x:0,y:0,scale:1,rotation:0,blur:0,reveal:p};
  default:return{opacity:1,x:0,y:0,scale:1,rotation:0,blur:0}; } }
export function interpolateKeyframes(frames,timeUs){ if(!frames?.length)return undefined; const s=[...frames].sort((a,b)=>a.timeUs-b.timeUs); if(timeUs<=s[0].timeUs)return s[0].value; if(timeUs>=s.at(-1).timeUs)return s.at(-1).value; const i=s.findIndex(f=>f.timeUs>=timeUs); const a=s[i-1],b=s[i],t=(timeUs-a.timeUs)/(b.timeUs-a.timeUs); if(typeof a.value==='number'&&typeof b.value==='number')return a.value+(b.value-a.value)*t; return t<.5?a.value:b.value; }
export function applyPresetRecord(project,record){ const r=normalizePresetRecord(record); const next=structuredClone(project); next.lyricStyle={...next.lyricStyle,...r.style,entrance:{...next.lyricStyle.entrance,...r.style.entrance},idle:{...next.lyricStyle.idle,...r.style.idle},exit:{...next.lyricStyle.exit,...r.style.exit}}; next.background={...next.background,...r.background}; next.visualizer={...next.visualizer,...r.visualizer}; next.videoEffects=normalizeVideoEffects(r.videoEffects); next.installedPresetId=r.id; next.presetProvenance={id:r.id,name:r.name,version:r.version,author:r.author}; return next; }
export function applyPreset(project,presetId){ const p=getPreset(presetId); return p?applyPresetRecord(project,factoryPresetToRecord(p)):project; }
