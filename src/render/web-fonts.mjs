const defs=[
  ['Anton','Impact, sans-serif'],['Bebas Neue','Impact, sans-serif'],['Oswald','Arial Narrow, sans-serif'],['Montserrat','Arial, sans-serif'],['Poppins','Arial, sans-serif'],['Roboto Condensed','Arial Narrow, sans-serif'],['Barlow Condensed','Arial Narrow, sans-serif'],['Archivo Black','Arial Black, sans-serif'],['Black Ops One','Impact, sans-serif'],['Orbitron','Arial, sans-serif'],['Audiowide','Arial, sans-serif'],['Cinzel','Georgia, serif'],['Playfair Display','Georgia, serif'],['Cormorant Garamond','Georgia, serif'],['DM Serif Display','Georgia, serif'],['Permanent Marker','cursive'],['Bangers','Impact, sans-serif'],['Creepster','Impact, sans-serif'],['Rock Salt','cursive'],['Caveat','cursive'],['Pacifico','cursive'],['Lobster','cursive'],['Righteous','Arial Black, sans-serif'],['Russo One','Arial Black, sans-serif'],['Teko','Arial Narrow, sans-serif'],['Rajdhani','Arial, sans-serif'],['Unbounded','Arial Black, sans-serif'],['Space Grotesk','Arial, sans-serif'],['Space Mono','monospace']
];
export const WEB_FONTS=defs.map(([family,fallback])=>({family,fallback}));
const byFamily=new Map(WEB_FONTS.map(f=>[f.family.toLowerCase(),f]));
const pending=new Map();
function cleanFamily(value=''){return String(value).split(',')[0].replace(/["']/g,'').trim();}
export function getWebFont(value){return byFamily.get(cleanFamily(value).toLowerCase())||null;}
export function fontStack(family){const f=getWebFont(family);return f?`"${f.family}", ${f.fallback}`:String(family);}
export function webFontCssUrl(family){const f=getWebFont(family);if(!f)return'';const q=encodeURIComponent(f.family).replace(/%20/g,'+');return `https://fonts.googleapis.com/css2?family=${q}&display=swap`;}
function slug(family){return cleanFamily(family).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export async function ensureWebFont(value,{documentLike=globalThis.document,timeoutMs=6000}={}){
  const f=getWebFont(value);if(!f||!documentLike?.head)return false;
  const key=f.family.toLowerCase();if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    const tag=slug(f.family);let link=documentLike.querySelector?.(`link[data-lyricforge-font="${tag}"]`);
    if(!link){
      link=documentLike.createElement('link');link.rel='stylesheet';link.href=webFontCssUrl(f.family);link.dataset.lyricforgeFont=tag;
      await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve();};link.onload=finish;link.onerror=finish;documentLike.head.append(link);setTimeout(finish,timeoutMs);});
    }
    try{await Promise.race([documentLike.fonts?.load?.(`16px "${f.family}"`)||Promise.resolve(),new Promise(r=>setTimeout(r,timeoutMs))]);}catch{}
    return true;
  })();
  pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
