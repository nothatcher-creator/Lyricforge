export function pinchValue(startValue,startDistance,currentDistance,min=.25,max=4){
  const base=Number(startValue)||1,a=Math.max(1,Number(startDistance)||1),b=Math.max(1,Number(currentDistance)||1);
  return Math.max(min,Math.min(max,base*b/a));
}
export function touchDistance(touches){if(!touches||touches.length<2)return 0;return Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);}

function isMediaFile(file){const type=String(file?.type||'');return type.startsWith('audio/')||type.startsWith('video/')||type.startsWith('image/');}
function closeCompactMediaSheet(files){if(typeof document==='undefined'||typeof matchMedia!=='function')return;if(!matchMedia('(max-width:820px)').matches)return;if(![...files||[]].some(isMediaFile))return;document.body.classList.remove('mobile-left-open');}
function installCompactMediaFlow(){
  if(typeof document==='undefined'||typeof window==='undefined')return;
  if(!document.querySelector('#compact-media-flow-style')){
    const style=document.createElement('style');style.id='compact-media-flow-style';style.textContent='@media(max-width:820px) and (orientation:portrait){.preview-controls{bottom:calc(73px + env(safe-area-inset-bottom))!important}.left-panel{pointer-events:none}.mobile-left-open .left-panel{pointer-events:auto}}';document.head.append(style);
  }
  const input=document.querySelector('#fileInput');
  if(input&&!input.dataset.mediaFlowFix){
    input.dataset.mediaFlowFix='1';
    input.addEventListener('click',()=>{input.value='';},{capture:true});
    input.addEventListener('change',()=>closeCompactMediaSheet(input.files));
  }
  const api=window.__LYRICFORGE__;
  if(api?.importFiles&&!api.__compactMediaFlowFix){
    const original=api.importFiles.bind(api);
    api.importFiles=async files=>{const list=[...files||[]];await original(list);closeCompactMediaSheet(list);};
    api.__compactMediaFlowFix=true;
    return;
  }
  if(!api?.__compactMediaFlowFix)setTimeout(installCompactMediaFlow,50);
}
if(typeof window!=='undefined')installCompactMediaFlow();
