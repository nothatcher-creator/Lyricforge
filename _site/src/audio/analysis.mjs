export function computePeaks(samples,bucketCount=1000){
  const n=Math.max(1,Math.min(bucketCount,samples.length||1)); const size=Math.ceil(samples.length/n); const out=[];
  for(let i=0;i<n;i++){let min=1,max=-1,found=false; const start=i*size,end=Math.min(samples.length,start+size); for(let j=start;j<end;j++){const v=samples[j]; if(v<min)min=v;if(v>max)max=v;found=true;} if(found)out.push({min,max});}
  return out;
}
export function mixToMono(audioBuffer){ const channels=audioBuffer.numberOfChannels; const len=audioBuffer.length; const mono=new Float32Array(len); for(let c=0;c<channels;c++){const d=audioBuffer.getChannelData(c);for(let i=0;i<len;i++)mono[i]+=d[i]/channels;} return mono; }
export function estimateBpm(samples,sampleRate){
  const abs=samples; let max=0; for(const v of abs)max=Math.max(max,Math.abs(v)); const threshold=Math.max(.2,max*.55); const minGap=Math.floor(sampleRate*.18); const onsets=[];
  let last=-minGap; for(let i=1;i<abs.length-1;i++){const a=Math.abs(abs[i]); if(a>=threshold && a>=Math.abs(abs[i-1]) && a>=Math.abs(abs[i+1]) && i-last>=minGap){onsets.push(i);last=i;}}
  if(onsets.length<2)return{bpm:0,confidence:0,beatsUs:[]};
  const intervals=[]; for(let i=1;i<onsets.length;i++)intervals.push((onsets[i]-onsets[i-1])/sampleRate); intervals.sort((a,b)=>a-b); let interval=intervals[Math.floor(intervals.length/2)]; let bpm=60/interval; while(bpm<70)bpm*=2; while(bpm>180)bpm/=2; bpm=Math.round(bpm*10)/10;
  const beatSec=60/bpm; const duration=samples.length/sampleRate; const start=onsets[0]/sampleRate; const beatsUs=[]; for(let t=start;t<=duration+1e-6;t+=beatSec)beatsUs.push(Math.round(t*1_000_000));
  const spread=intervals.reduce((s,x)=>s+Math.abs(x-interval),0)/intervals.length; return{bpm,confidence:Math.max(0,Math.min(1,1-spread/Math.max(interval,.001))),beatsUs};
}
