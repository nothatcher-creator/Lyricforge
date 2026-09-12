import { mixToMono, computePeaks, estimateBpm } from './analysis.mjs';
export class AudioEngine extends EventTarget{
  constructor(){super();this.ctx=null;this.buffer=null;this.source=null;this.gain=null;this.analyser=null;this.startedAt=0;this.offset=0;this.rate=1;this.volume=1;this.playing=false;this.assetUrl=null;}
  async ensure(resume=false){ if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.gain=this.ctx.createGain();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=2048;this.gain.connect(this.analyser).connect(this.ctx.destination);} if(resume&&this.ctx.state==='suspended')await this.ctx.resume(); }
  async load(blob){await this.ensure(); const arr=await blob.arrayBuffer(); this.buffer=await this.ctx.decodeAudioData(arr.slice(0)); this.offset=0; this.stop(); const mono=mixToMono(this.buffer); return{durationUs:Math.round(this.buffer.duration*1e6),peaks:computePeaks(mono,1400),beat:estimateBpm(mono,this.buffer.sampleRate)};}
  createSource(){const s=this.ctx.createBufferSource();s.buffer=this.buffer;s.playbackRate.value=this.rate;s.connect(this.gain);s.onended=()=>{if(this.playing&&this.currentTimeUs()>=this.durationUs()-20_000){this.playing=false;this.offset=0;this.dispatchEvent(new Event('ended'));}};return s;}
  async play(){if(!this.buffer)return;await this.ensure(true);if(this.playing)return;this.source=this.createSource();this.startedAt=this.ctx.currentTime;this.source.start(0,this.offset);this.playing=true;}
  pause(){if(!this.playing)return;this.offset=this.currentTimeUs()/1e6;try{this.source.stop();}catch{}this.playing=false;}
  stop(){if(this.source){try{this.source.stop();}catch{}this.source=null;}this.playing=false;this.offset=0;}
  seekUs(us){const was=this.playing;if(was)this.pause();this.offset=Math.max(0,Math.min((this.buffer?.duration||0),us/1e6));if(was)this.play();}
  setRate(rate){const now=this.currentTimeUs();const was=this.playing;if(was)this.pause();this.rate=Number(rate);this.offset=now/1e6;if(was)this.play();}
  setVolume(v){this.volume=Number(v);if(this.gain)this.gain.gain.value=this.volume;}
  currentTimeUs(){if(!this.playing||!this.ctx)return Math.round(this.offset*1e6);return Math.round((this.offset+(this.ctx.currentTime-this.startedAt)*this.rate)*1e6);}
  durationUs(){return Math.round((this.buffer?.duration||0)*1e6);}
  frequencyData(){if(!this.analyser)return new Uint8Array();const a=new Uint8Array(this.analyser.frequencyBinCount);this.analyser.getByteFrequencyData(a);return a;}
  stream(){if(!this.ctx||!this.source)return null;const dest=this.ctx.createMediaStreamDestination();this.gain.connect(dest);return dest.stream;}
}
