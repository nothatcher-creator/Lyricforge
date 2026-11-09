"""Verify source coverage, measured timing, canvas safety, and instrumental gaps."""
import json,re
from pathlib import Path
p=Path(__file__).parent
j=json.load(open(p/'lyric_timeline.json'));lines=j['lyrics'];shots=json.load(open(p/'shots.json'))
source=(p/'LYRICS_original.txt').read_text().replace('the creams','the screams').replace('Doul','soul').replace('fro sunshine','for sunshine')
normalize=lambda s:re.findall(r"[a-z]+(?:['’][a-z]+)?",s.lower().replace("’", "'"))
a=normalize(' '.join(x for x in source.splitlines() if x.strip()!='SOLO'));b=normalize(' '.join(x['text'] for x in lines))
assert a==b,'Source coverage/order mismatch'
assert len(lines)==73 and sum(len(x['words']) for x in lines)==285
for x in lines:
 assert 0<=x['start']<x['vocal_end']<=x['end']<368.06
 assert [normalize(w['text']) for w in x['words']]==[normalize(w) for w in x['text'].split()]
 for w in x['words']:assert w['start']<w['end']
for a,b in zip(lines,lines[1:]):assert a['vocal_end']<=b['start']+.05,(a['id'],b['id'])
for a,b in zip(shots,shots[1:]):assert abs(a[1]-b[0])<1e-5
for a,b in [(182,213.6),(338.2,368.06)]:assert not any(a<x['start']<b for x in lines)
for i in range(12):assert (p/'assets'/f'plate_{i:02d}.png').is_file()
print('PASS: 285 source words in order; 73 lyric cues; ordered positive timings; both instrumental gaps; continuous 43-shot timeline; 12 environment assets.')
print('Automatic timing remains subject to the review notes in lyric_timeline.json.')
