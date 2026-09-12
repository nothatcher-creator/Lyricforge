import { createLyricEvent, createWord } from '../core/model.mjs';
import { configureTransformersRuntime, friendlyModelDownloadError } from './model-fetch.mjs';

export const TRANSFORMERS_RUNTIME_URLS=[
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1',
  'https://esm.sh/@huggingface/transformers@4.0.1',
  'https://unpkg.com/@huggingface/transformers@4.0.1'
];
const DEFAULT_MODEL='onnx-community/whisper-tiny';

function conf(seg){
  if(Number.isFinite(seg.confidence))return Math.max(0,Math.min(1,seg.confidence));
  if(Number.isFinite(seg.avg_logprob))return Math.max(0,Math.min(1,Math.exp(seg.avg_logprob)));
  return 1;
}

export function normalizeTranscript(result){
  const segments=result?.segments||result?.results||[];
  return segments.map(seg=>{
    const e=createLyricEvent(String(seg.text||'').trim(),Math.round((seg.start||0)*1e6),Math.round((seg.end??((seg.start||0)+2))*1e6));
    e.confidence=conf(seg);
    e.source={type:'auto'};
    e.words=(seg.words||[]).map(w=>createWord(String(w.word||w.text||'').trim(),Math.round((w.start||0)*1e6),Math.round((w.end ?? w.start ?? 0)*1e6),Number.isFinite(w.probability)?w.probability:(w.confidence??1)));
    return e;
  });
}

function cleanWord(text){return String(text||'').replace(/^\s+/,'').replace(/\s+/g,' ').trim();}
function finiteTime(value,fallback=0){return Number.isFinite(value)?Math.max(0,value):fallback;}
function lineFromWords(words){
  const text=words.map(w=>w.text).join(' ').replace(/\s+([,.;!?…:])/g,'$1').trim();
  const event=createLyricEvent(text,words[0]?.startUs??0,words.at(-1)?.endUs??(words[0]?.startUs??0));
  event.words=words;
  event.confidence=words.length?words.reduce((n,w)=>n+(w.confidence??1),0)/words.length:1;
  event.source={type:'auto-local'};
  return event;
}

export function normalizeBrowserWhisperResult(result,{durationUs=0,maxWords=10,maxChars=72,gapSeconds=.8}={}){
  const chunks=Array.isArray(result?.chunks)?result.chunks:[];
  const words=[];
  for(const chunk of chunks){
    const text=cleanWord(chunk?.text);
    if(!text)continue;
    const ts=Array.isArray(chunk.timestamp)?chunk.timestamp:Array.isArray(chunk.timestamps)?chunk.timestamps:[chunk.start,chunk.end];
    const start=finiteTime(ts?.[0],words.at(-1)?.endUs/1e6||0);
    const end=finiteTime(ts?.[1],start+.25);
    words.push(createWord(text,Math.round(start*1e6),Math.round(Math.max(start,end)*1e6),Number.isFinite(chunk.confidence)?chunk.confidence:1));
  }
  if(!words.length){
    const text=String(result?.text||'').trim();
    if(!text)return [];
    const event=createLyricEvent(text,0,Math.max(1_000_000,durationUs||2_000_000));
    event.source={type:'auto-local'};
    event.confidence=1;
    return [event];
  }
  const events=[];let line=[];let chars=0;
  const flush=()=>{if(line.length){events.push(lineFromWords(line));line=[];chars=0;}};
  for(const word of words){
    const prev=line.at(-1);
    const gap=prev?(word.startUs-prev.endUs)/1e6:0;
    if(line.length&&(gap>=gapSeconds||/[.!?…]$/.test(prev.text)||line.length>=maxWords||chars+word.text.length+1>maxChars))flush();
    line.push(word);chars+=word.text.length+(line.length>1?1:0);
  }
  flush();
  return events;
}

export function inferSections(events){
  const out=structuredClone(events),counts=new Map();
  for(const e of out){const k=e.text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(k.length>3)counts.set(k,(counts.get(k)||0)+1);}
  let verse=1,chorus=1;
  for(const e of out){
    const k=e.text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if((counts.get(k)||0)>1){e.sectionType='chorus';e.sectionId=`chorus-${chorus}`;}
    else{e.sectionType='verse';e.sectionId=`verse-${verse}`;verse += e.text.endsWith('.')?1:0;}
  }
  return out;
}

export function instrumentalGaps(events,minGapUs=4_000_000){
  const s=[...events].sort((a,b)=>a.startUs-b.startUs),g=[];
  for(let i=1;i<s.length;i++)if(s[i].startUs-s[i-1].endUs>=minGapUs)g.push({startUs:s[i-1].endUs,endUs:s[i].startUs,type:'instrumental'});
  return g;
}

export function browserWhisperSupport(navigatorLike=globalThis.navigator||{}){
  if(navigatorLike?.gpu)return {available:true,device:'webgpu',reason:'WebGPU available'};
  return {available:true,device:'wasm',reason:'WASM fallback'};
}

export function whisperLoadProfile(device){
  if(device==='webgpu')return {device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'q4'}};
  return {device:'wasm',dtype:'fp32'};
}

export function isQuantizedSessionError(error){
  const message=String(error?.message||error||'');
  return /(?:qdq_actions|MatMulNBits|Missing required scale|DequantizeLinear)/i.test(message);
}

export function friendlyWhisperRuntimeError(error){
  if(error?.name==='AbortError')return error.message||'Transcription cancelled.';
  if(isQuantizedSessionError(error))return 'This browser could not start the optimized Whisper model. LyricForge retried with a safe compatibility model, but the local AI session still failed. Reload the app and try Fast quality again, or use an Advanced provider.';
  return friendlyModelDownloadError(error);
}

async function defaultRuntimeLoader(){
  let lastError;
  for(const url of TRANSFORMERS_RUNTIME_URLS){try{return await import(url);}catch(error){lastError=error;}}
  throw new Error(friendlyModelDownloadError(lastError));
}

export async function decodeAudioBlob16k(blob){
  if(!(blob instanceof Blob))throw new TypeError('Audio must be a Blob.');
  const AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioCtx)throw new Error('This browser cannot decode audio for local transcription.');
  const context=new AudioCtx();
  try{
    const decoded=await context.decodeAudioData(await blob.arrayBuffer());
    const channels=decoded.numberOfChannels;
    const mono=new Float32Array(decoded.length);
    for(let c=0;c<channels;c++){
      const data=decoded.getChannelData(c);
      for(let i=0;i<data.length;i++)mono[i]+=data[i]/channels;
    }
    if(decoded.sampleRate===16000)return mono;
    const length=Math.max(1,Math.round(mono.length*16000/decoded.sampleRate));
    const out=new Float32Array(length),ratio=decoded.sampleRate/16000;
    for(let i=0;i<length;i++){
      const p=i*ratio,a=Math.floor(p),b=Math.min(mono.length-1,a+1),t=p-a;
      out[i]=(mono[a]||0)*(1-t)+(mono[b]||0)*t;
    }
    return out;
  }finally{await context.close?.().catch?.(()=>{});}
}

export function whisperPartialProgress(text){return {phase:'transcribe',progress:.86,message:'Transcribing lyrics live…',partial:String(text||'').trim()};}
export function modelRetryProgress(info={}){const mirror=!!info.mirror;const seconds=Math.max(1,Math.ceil((Number(info.delay)||0)/1000));return {phase:'model',progress:.05,message:mirror?`Primary model host is busy — trying backup source…`:`Model host is busy — retrying automatically in ${seconds}s…`,detail:info};}

function abortError(){return new DOMException('Transcription aborted','AbortError');}
function throwIfAborted(signal){if(signal?.aborted)throw abortError();}

export class BrowserWhisperProvider{
  constructor({runtimeLoader=null,audioDecoder=decodeAudioBlob16k,navigatorLike=globalThis.navigator||{},model=DEFAULT_MODEL,workerFactory=null}={}){
    this.id='browser-whisper';this.name='Built-in Whisper';this.model=model;
    this.capabilities={uploads:false,wordTimestamps:true,confidence:true,requiresSetup:false,local:true};
    this.runtimeLoader=runtimeLoader;this.audioDecoder=audioDecoder;this.navigatorLike=navigatorLike;this.pipelineCache=new Map();
    this.workerFactory=workerFactory||(()=>new Worker(new URL('./whisper-worker.mjs',import.meta.url),{type:'module'}));
    this.worker=null;
  }
  async getPipeline(device,onProgress){
    const profile=whisperLoadProfile(device),dtype=profile.dtype,key=`${this.model}|${device}|${JSON.stringify(dtype)}`;
    if(this.pipelineCache.has(key))return this.pipelineCache.get(key);
    const runtime=configureTransformersRuntime(await (this.runtimeLoader||defaultRuntimeLoader)());
    const pending=runtime.pipeline('automatic-speech-recognition',this.model,{
      device,dtype,
      progress_callback:(info)=>{
        if(info?.status==='progress_total'&&Number.isFinite(info.progress))onProgress({phase:'model',progress:.05+Math.max(0,Math.min(100,info.progress))/100*.7,message:`Downloading AI model · ${Math.round(info.progress)}%`,detail:info});
        else if(info?.status==='ready')onProgress({phase:'model',progress:.76,message:'AI model ready',detail:info});
      }
    });
    this.pipelineCache.set(key,pending);
    try{return await pending;}catch(error){this.pipelineCache.delete(key);throw error;}
  }
  async transcribeWithWorker(waveform,device,options,onProgress,signal){
    if(typeof Worker==='undefined')return null;
    const worker=this.worker??=this.workerFactory();
    const id=crypto.randomUUID(),durationUs=Math.round(waveform.length/16000*1e6);
    return new Promise((resolve,reject)=>{
      let settled=false;
      const cleanup=()=>{worker.removeEventListener('message',message);signal?.removeEventListener('abort',abort);};
      const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);};
      const abort=()=>{this.worker?.terminate();this.worker=null;finish(reject,abortError());};
      const message=(event)=>{const msg=event.data||{};if(msg.id!==id)return;
        if(msg.type==='model-progress'){const info=msg.info||{};if(info.status==='progress_total'&&Number.isFinite(info.progress))onProgress({phase:'model',progress:.05+Math.max(0,Math.min(100,info.progress))/100*.7,message:`Downloading AI model · ${Math.round(info.progress)}%`,detail:info});}
        else if(msg.type==='model-retry')onProgress(modelRetryProgress(msg.info||{}));
        else if(msg.type==='partial')onProgress(whisperPartialProgress(msg.text));
        else if(msg.type==='error')finish(reject,new Error(msg.message||'Local transcription failed'));
        else if(msg.type==='result')finish(resolve,{result:msg.result,durationUs});
      };
      worker.addEventListener('message',message);signal?.addEventListener('abort',abort,{once:true});
      const profile=whisperLoadProfile(device);
      worker.postMessage({type:'transcribe',id,waveform,model:this.model,device:profile.device,dtype:profile.dtype,options},[waveform.buffer]);
    });
  }
  async transcribe(audioBlob,options={},onProgress=()=>{},signal){
    throwIfAborted(signal);
    const support=browserWhisperSupport(this.navigatorLike),explicitDevice=options.device||null;
    let device=explicitDevice||support.device;
    onProgress({phase:'audio',progress:.02,message:'Preparing audio locally'});
    const waveform=await this.audioDecoder(audioBlob);
    const durationUs=Math.round(waveform.length/16000*1e6);
    throwIfAborted(signal);
    const run=async(targetDevice)=>{
      onProgress({phase:'model',progress:.05,message:targetDevice==='webgpu'?'Preparing Whisper with WebGPU':'Preparing Whisper with CPU/WASM'});
      let result;
      if(!this.runtimeLoader&&typeof Worker!=='undefined'){
        const transferable=targetDevice==='webgpu'&&!explicitDevice?waveform.slice():waveform;
        const workerResult=await this.transcribeWithWorker(transferable,targetDevice,options,onProgress,signal);
        result=workerResult.result;
      }else{
        const pipe=await this.getPipeline(targetDevice,onProgress);
        throwIfAborted(signal);
        onProgress({phase:'transcribe',progress:.8,message:'Listening to vocals…'});
        const runOptions={return_timestamps:'word',chunk_length_s:options.chunkLengthS||30,stride_length_s:options.strideLengthS||5,task:'transcribe'};
        if(options.language&&options.language!=='auto')runOptions.language=options.language;
        result=await pipe(waveform,runOptions);
      }
      return result;
    };
    let result;
    try{result=await run(device);}catch(error){
      if(device==='webgpu'&&!explicitDevice&&error?.name!=='AbortError'){
        onProgress({phase:'model',progress:.05,message:isQuantizedSessionError(error)?'GPU model format was incompatible — retrying with safe CPU model':'WebGPU unavailable here — switching to CPU/WASM'});
        device='wasm';
        try{result=await run(device);}catch(fallbackError){
          if(fallbackError?.name==='AbortError')throw fallbackError;
          throw new Error(friendlyWhisperRuntimeError(fallbackError));
        }
      }else{
        if(error?.name==='AbortError')throw error;
        throw new Error(friendlyWhisperRuntimeError(error));
      }
    }
    throwIfAborted(signal);
    onProgress({phase:'structure',progress:.95,message:'Building editable lyric lines',partial:String(result?.text||'').trim()});
    let events=normalizeBrowserWhisperResult(result,{durationUs});
    events=inferSections(events);
    onProgress({phase:'done',progress:1,message:'Lyrics ready to edit',partial:events.map(e=>e.text).join('\n')});
    return events;
  }
}

export class LocalTimingAssistProvider{
  id='local-timing';name='Local Timing Assist';capabilities={uploads:false,wordTimestamps:false,confidence:false,requiresSetup:false};
  async transcribe(_audio,{draftText='',durationUs=180_000_000}={},onProgress=()=>{}){
    onProgress({progress:.2,message:'Preparing local timing guide'});
    const lines=draftText.split(/\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)throw new Error('Paste or type lyrics first for Local Timing Assist.');
    const each=durationUs/lines.length;
    const events=lines.map((line,i)=>createLyricEvent(line,Math.round(i*each),Math.round((i+1)*each)));
    onProgress({progress:1,message:'Timing guide ready',partial:lines.join('\n')});return events;
  }
}

export class WhisperRemoteProvider{
  constructor(endpoint,apiKey=''){this.endpoint=endpoint;this.apiKey=apiKey;this.id='whisper-remote';this.name='Whisper-compatible API';this.capabilities={uploads:true,wordTimestamps:true,confidence:true,requiresSetup:true};}
  async transcribe(audioBlob,options={},onProgress=()=>{},signal){
    if(!this.endpoint)throw new Error('Whisper endpoint is required.');onProgress({progress:.1,message:'Uploading audio'});
    const form=new FormData();form.append('file',audioBlob,'audio'+(audioBlob.type.includes('wav')?'.wav':'.mp3'));form.append('response_format','verbose_json');form.append('timestamp_granularities[]','word');if(options.language)form.append('language',options.language);
    const headers={};if(this.apiKey)headers.Authorization=`Bearer ${this.apiKey}`;
    const res=await fetch(this.endpoint,{method:'POST',headers,body:form,signal});if(!res.ok)throw new Error(`Transcription failed (${res.status})`);
    onProgress({progress:.8,message:'Normalizing transcript'});const data=await res.json();let events=normalizeTranscript(data);events=inferSections(events);onProgress({progress:1,message:'Transcription complete',partial:events.map(e=>e.text).join('\n')});return events;
  }
}
