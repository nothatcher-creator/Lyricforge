#!/usr/bin/env python3
"""Recover the already-rendered full-quality MP4 from verified Git-sized chunks."""
from pathlib import Path
import argparse,hashlib,json
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--output',default=str(ROOT/'renders'/'DEMONS_SWAN_1080p.mp4'));a=p.parse_args()
m=json.loads((ROOT/'rendered'/'manifest.json').read_text());out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256()
with out.open('wb') as dest:
 for row in m['parts']:
  part=ROOT/'rendered'/'parts'/row['name'];ph=hashlib.sha256()
  with part.open('rb') as source:
   for chunk in iter(lambda:source.read(4*1024*1024),b''):ph.update(chunk);h.update(chunk);dest.write(chunk)
  assert ph.hexdigest()==row['sha256'],f'Chunk checksum failed: {part.name}'
assert out.stat().st_size==m['size_bytes'] and h.hexdigest()==m['sha256'],'Video checksum mismatch'
print(f'Verified full-quality video: {out} ({out.stat().st_size} bytes)')
