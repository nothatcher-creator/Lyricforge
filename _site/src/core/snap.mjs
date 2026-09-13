export function snapTimeUs(timeUs,{thresholdUs=80_000,playheadUs=null,beats=[],markers=[],lyrics=[],clips=[]}={}){
  const candidates=[]; if(Number.isFinite(playheadUs))candidates.push({timeUs:playheadUs,source:'playhead'}); for(const t of beats)candidates.push({timeUs:typeof t==='number'?t:t.timeUs,source:'beat'});for(const t of markers)candidates.push({timeUs:typeof t==='number'?t:t.timeUs,source:'marker'});for(const e of lyrics)candidates.push({timeUs:e.startUs,source:'lyric'},{timeUs:e.endUs,source:'lyric'});for(const c of clips)candidates.push({timeUs:c.startUs,source:'clip'},{timeUs:c.endUs,source:'clip'});
  let best=null;for(const c of candidates){const d=Math.abs(c.timeUs-timeUs);if(d<=thresholdUs&&(!best||d<best.distance)){best={...c,distance:d};}}
  return best?{timeUs:best.timeUs,source:best.source}:{timeUs,source:null};
}
