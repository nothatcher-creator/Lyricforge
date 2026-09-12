import { configureTransformersRuntime, friendlyModelDownloadError } from './model-fetch.mjs';
const TRANSFORMERS_RUNTIME_URLS=[
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1',
  'https://esm.sh/@huggingface/transformers@4.0.1',
  'https://unpkg.com/@huggingface/transformers@4.0.1'
];
const pipelines=new Map();
let runtimePromise;
async function loadRuntime(){let lastError;for(const url of TRANSFORMERS_RUNTIME_URLS){try{return configureTransformersRuntime(await import(url),{onRetry:info=>postMessage({type:'model-retry',info})});}catch(error){lastError=error;}}throw new Error(friendlyModelDownloadError(lastError));}
const runtime=()=>runtimePromise??=loadRuntime();
self.onmessage=async(event)=>{
  const data=event.data||{};if(data.type!=='transcribe')return;
  const {id,waveform,model='onnx-community/whisper-tiny',device='wasm',dtype=device==='webgpu'?{encoder_model:'fp32',decoder_model_merged:'q4'}:'fp32',options={}}=data;
  try{
    const {pipeline,WhisperTextStreamer}=await runtime(),key=`${model}|${device}|${JSON.stringify(dtype)}`;
    if(!pipelines.has(key))pipelines.set(key,pipeline('automatic-speech-recognition',model,{device,dtype,progress_callback:info=>postMessage({type:'model-progress',id,info})}));
    let pipe;
    try{pipe=await pipelines.get(key);}catch(error){pipelines.delete(key);throw error;}
    let partial='';
    const streamer=WhisperTextStreamer&&pipe.tokenizer?new WhisperTextStreamer(pipe.tokenizer,{
      skip_prompt:true,
      callback_function:text=>{partial+=text;postMessage({type:'partial',id,text:partial.trim()});}
    }):null;
    const runOptions={return_timestamps:'word',chunk_length_s:options.chunkLengthS||30,stride_length_s:options.strideLengthS||5,task:'transcribe',...(options.language&&options.language!=='auto'?{language:options.language}:{})};
    if(streamer)runOptions.streamer=streamer;
    const result=await pipe(waveform,runOptions);
    postMessage({type:'result',id,result});
  }catch(error){postMessage({type:'error',id,message:friendlyModelDownloadError(error),stack:error?.stack||''});}
};
