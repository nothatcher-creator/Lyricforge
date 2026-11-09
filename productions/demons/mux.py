#!/usr/bin/env python3
"""Mux the complete, unchanged original AAC track; verify decoded PCM equality."""
import argparse,json,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def run(cmd):return subprocess.run(cmd,check=True,capture_output=True,text=True).stdout

def audio_hash(path):
 return run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c:a','pcm_s16le','-f','hash','-hash','sha256','-']).strip()

def packet_hash(path):
 p=subprocess.Popen(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c:a','copy','-f','adts','-'],stdout=subprocess.PIPE)
 h=hashlib.sha256()
 for b in iter(lambda:p.stdout.read(1024*1024),b''):h.update(b)
 if p.wait():raise RuntimeError('AAC extraction failed')
 return h.hexdigest()

def main():
 a=argparse.ArgumentParser();a.add_argument('--picture',required=True);a.add_argument('--audio',default=str(ROOT/'assets'/'mixing Demons.m4a'));a.add_argument('--output',default=str(ROOT/'renders'/'DEMONS_SWAN_1080p.mp4'));args=a.parse_args()
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
 run(['ffmpeg','-y','-v','error','-i',args.picture,'-i',args.audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-map_metadata','1','-metadata','title=DEMONS','-metadata','artist=SWAN','-metadata','comment=Music and Video by Carl Korytko; Lyrics and Spoken Word by #WEED_SMOK','-movflags','+faststart',str(out)])
 source_pcm,output_pcm=audio_hash(args.audio),audio_hash(out)
 source_aac,output_aac=packet_hash(args.audio),packet_hash(out)
 probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out)]))
 report={'source':str(args.audio),'output':str(out),'pcm_sha256_source':source_pcm,'pcm_sha256_output':output_pcm,'pcm_identical':source_pcm==output_pcm,'aac_sha256_source':source_aac,'aac_sha256_output':output_aac,'aac_bitstream_identical':source_aac==output_aac,'streams':[{k:s.get(k) for k in ['codec_name','codec_type','width','height','r_frame_rate','sample_rate','channels','start_time','duration','nb_frames']} for s in probe['streams']],'duration':probe['format']['duration'],'size_bytes':int(probe['format']['size'])}
 (out.parent/'technical_verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
 if not report['pcm_identical'] or not report['aac_bitstream_identical']:raise SystemExit('Original audio equality check failed')
if __name__=='__main__':main()
