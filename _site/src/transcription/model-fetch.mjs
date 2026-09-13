const DEFAULT_MIRRORS=['https://hf-mirror.com'];
const RETRY_STATUSES=new Set([408,425,429,500,502,503,504]);

export function parseRetryAfterMs(value,now=Date.now()){
  if(value==null||value==='')return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds))return Math.max(0,Math.round(seconds*1000));
  const when=Date.parse(value);
  return Number.isFinite(when)?Math.max(0,when-now):null;
}

function requestUrl(input){
  if(typeof input==='string')return input;
  if(input instanceof URL)return input.href;
  if(typeof Request!=='undefined'&&input instanceof Request)return input.url;
  return String(input);
}

export function rewriteModelUrl(input,mirror){
  const url=new URL(requestUrl(input));
  if(url.hostname!=='huggingface.co')return url.href;
  const base=new URL(mirror);
  base.pathname=base.pathname.replace(/\/$/,'')+url.pathname;
  base.search=url.search;
  base.hash=url.hash;
  return base.href;
}

function rebuildInput(input,url){
  if(typeof Request!=='undefined'&&input instanceof Request)return new Request(url,input);
  return url;
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function createResilientModelFetch(baseFetch=globalThis.fetch,{maxRetries=2,mirrors=DEFAULT_MIRRORS,sleep=wait,maxDelayMs=8_000,onRetry=()=>{}}={}){
  if(typeof baseFetch!=='function')throw new TypeError('A fetch implementation is required.');
  return async function resilientModelFetch(input,init){
    const originalUrl=requestUrl(input),isHub=(()=>{try{return new URL(originalUrl).hostname==='huggingface.co';}catch{return false;}})();
    const targets=[originalUrl,...(isHub?mirrors.map(m=>rewriteModelUrl(originalUrl,m)):[])];
    let lastResponse=null,lastError=null;
    for(let targetIndex=0;targetIndex<targets.length;targetIndex++){
      const target=targets[targetIndex];
      for(let attempt=0;attempt<=maxRetries;attempt++){
        try{
          const response=await baseFetch(rebuildInput(input,target),init);
          lastResponse=response;
          if(response.ok||!RETRY_STATUSES.has(response.status))return response;
          if(attempt<maxRetries){
            const retryAfter=parseRetryAfterMs(response.headers?.get?.('Retry-After'));
            const delay=Math.min(maxDelayMs,retryAfter??(750*2**attempt));
            onRetry({url:target,status:response.status,attempt:attempt+1,delay,mirror:targetIndex>0});
            await sleep(delay);
            continue;
          }
        }catch(error){
          lastError=error;
          if(attempt<maxRetries){
            const delay=Math.min(maxDelayMs,750*2**attempt);
            onRetry({url:target,error,attempt:attempt+1,delay,mirror:targetIndex>0});
            await sleep(delay);
            continue;
          }
        }
        break;
      }
    }
    if(lastResponse)return lastResponse;
    throw lastError||new Error('Model download failed.');
  };
}

export function configureTransformersRuntime(runtime,{fetchImpl=globalThis.fetch,onRetry=()=>{}}={}){
  if(!runtime?.env||runtime.env.__lyricforgeResilientFetch)return runtime;
  runtime.env.fetch=createResilientModelFetch(fetchImpl,{onRetry});
  runtime.env.__lyricforgeResilientFetch=true;
  return runtime;
}

export function friendlyModelDownloadError(error){
  const message=String(error?.message||error||'').trim();
  if(/\b429\b|too many requests|rate.?limit/i.test(message))return 'The AI model host is busy right now. LyricForge retried automatically and tried a backup mirror. Wait a minute, then press Transcribe Song again.';
  if(/failed to fetch|network|load failed/i.test(message))return 'The AI model could not be downloaded. Check your internet connection, then press Transcribe Song again. Once downloaded, the model is cached in your browser.';
  return message||'The built-in transcription model could not be loaded.';
}
