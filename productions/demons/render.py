#!/usr/bin/env python3
"""DEMONS: deterministic layered OpenGL music-video renderer.
Original AAC is stream-copied by mux.py. All times are seconds from decoded start.
"""
import os
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE','1')
os.environ.setdefault('LP_NUM_THREADS','2')
import argparse,json,math,subprocess,time,hashlib
from pathlib import Path
import numpy as np
import moderngl
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
VERT='''#version 330
in vec2 in_pos;out vec2 uv;void main(){uv=in_pos*.5+.5;gl_Position=vec4(in_pos,0,1);}'''
SPRITE_VERT='''#version 330
in vec2 in_pos;out vec2 uv;uniform vec4 box;uniform vec2 resolution;uniform float rotation;
void main(){uv=in_pos*.5+.5;vec2 p=in_pos*box.zw*.5;float c=cos(rotation),s=sin(rotation);p=mat2(c,-s,s,c)*p+box.xy;gl_Position=vec4(p/resolution*vec2(2,-2)+vec2(-1,1),0,1);}'''
SPRITE_FRAG='''#version 330
uniform sampler2D tex;uniform vec4 color;uniform float dissolve;uniform float reveal;uniform float phase;uniform float fracture;in vec2 uv;out vec4 fragColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=uv;float stripe=floor(p.y*17.);p.x+=sin(stripe*9.1+phase)*fracture*.025;
float a=texture(tex,p).a;
float dust=hash(floor(p*vec2(420,120)));a*=smoothstep(dissolve-.12,dissolve+.05,dust+.04);
a*=smoothstep(p.x-.15,p.x+.04,reveal);
vec3 c=color.rgb*mix(vec3(.71,.79,.87),vec3(1.0,.99,.94),1.-p.y);
fragColor=vec4(c,a*color.a);}'''
PART_VERT='''#version 330
in vec4 seed;uniform float time;uniform float intensity;uniform float flow;uniform float scale;uniform float warmth;out vec4 col;
void main(){float z=fract(seed.z+time*(.009+flow*.012)) * 3.+.4;
float x=(seed.x*2.-1.)*2.5+sin(time*.17+seed.w*20.)*.09;
float y=(fract(seed.y+time*(.005+flow*.003))- .5)*2.;
gl_Position=vec4(x/z,y/z,0,1);gl_PointSize=(1.+seed.w*5.)*scale/z;
col=vec4(mix(vec3(.62,.75,.86),vec3(.92,.57,.3),warmth),(.13+seed.w*.2)*intensity);}
'''
PART_FRAG='''#version 330
in vec4 col;out vec4 fragColor;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),2.);fragColor=vec4(col.rgb,col.a*a);}'''
MESH_VERT='''#version 330
in vec3 position;in vec3 normal;in vec4 seed;uniform float time;uniform float amount;uniform float aspect;uniform float travel;out vec3 norm;out float dist;out float edge;
void main(){float t=time*(.07+seed.w*.07);float c=cos(t),s=sin(t);mat3 R=mat3(c,0,s,0,1,0,-s,0,c);vec3 p=R*position;
vec3 center=vec3((seed.x*2.-1.)*12.,(seed.y*2.-1.)*7.,-2.-fract(seed.z-time*travel)*28.);
p+=center;float z=-p.z;
gl_Position=vec4(p.x*1.45/aspect,p.y*1.45,z*.97-.2,z);norm=R*normal;dist=z;edge=seed.w;}
'''
MESH_FRAG='''#version 330
in vec3 norm;in float dist;in float edge;uniform float amount;uniform float red;uniform float light;out vec4 fragColor;
void main(){float diffuse=max(0.,dot(normalize(norm),normalize(vec3(-.6,1.,.5))));vec3 c=mix(vec3(.035,.045,.057),vec3(.18,.23,.28),diffuse);
c+=vec3(.13,.012,.02)*red*max(0.,norm.x)*.4;c*=.8+light*.4;float a=amount*smoothstep(1.,3.,dist)*(1.-smoothstep(21.,30.,dist));fragColor=vec4(c,a);}
'''

def smooth(x):x=max(0.,min(1.,x));return x*x*(3-2*x)
def mix(a,b,x):return a*(1-x)+b*x

class Video:
 def __init__(self,width=1920,height=1080):
  self.w,self.h=width,height;self.s=width/1920
  self.ctx=moderngl.create_standalone_context(backend='egl')
  print('Renderer:',self.ctx.info['GL_RENDERER'],flush=True)
  self.frame=self.ctx.simple_framebuffer((width,height),components=3);self.frame.use()
  self.lowtex=self.ctx.texture((min(width,1280),min(height,720)),3);self.lowtex.filter=(moderngl.LINEAR,moderngl.LINEAR);self.low=self.ctx.framebuffer(color_attachments=[self.lowtex])
  self.quad=self.ctx.buffer(np.array([-1,-1,1,-1,-1,1,1,1],dtype='f4').tobytes())
  self.bg=self.ctx.program(vertex_shader=VERT,fragment_shader=(ROOT/'visual.frag').read_text())
  self.bgvao=self.ctx.simple_vertex_array(self.bg,self.quad,'in_pos')
  self.copy=self.ctx.program(vertex_shader=VERT,fragment_shader='''#version 330
uniform sampler2D tex;in vec2 uv;out vec4 fragColor;void main(){fragColor=texture(tex,uv);}''')
  self.copyvao=self.ctx.simple_vertex_array(self.copy,self.quad,'in_pos')
  self.sprite=self.ctx.program(vertex_shader=SPRITE_VERT,fragment_shader=SPRITE_FRAG)
  self.svao=self.ctx.simple_vertex_array(self.sprite,self.quad,'in_pos')
  self.sprite['resolution']=(width,height)
  self.plates=[]
  for i in range(12):
   im=Image.open(ROOT/'assets'/f'plate_{i:02d}.png').convert('RGB')
   tx=self.ctx.texture(im.size,3,im.tobytes());tx.filter=(moderngl.LINEAR,moderngl.LINEAR);tx.repeat_x=False;tx.repeat_y=False;self.plates.append(tx)
  rng=np.random.default_rng(42)
  noise=(rng.random((256,256))*255).astype('uint8')
  self.noise=self.ctx.texture((256,256),1,noise.tobytes());self.noise.filter=(moderngl.LINEAR,moderngl.LINEAR);self.noise.use(2)
  self.bg['plateA']=0;self.bg['plateB']=1;self.bg['noiseTex']=2
  self.audio=json.load(open(ROOT/'audio_analysis.json'))
  self.timeline=json.load(open(ROOT/'lyric_timeline.json'))['lyrics']
  self.shots=json.load(open(ROOT/'shots.json'))
  self.cache={};self.fonts={};self.layouts={}
  pp=rng.random((440,4)).astype('f4');self.pprog=self.ctx.program(vertex_shader=PART_VERT,fragment_shader=PART_FRAG)
  self.pvao=self.ctx.simple_vertex_array(self.pprog,self.ctx.buffer(pp.tobytes()),'seed')
  self.meshprog=self.ctx.program(vertex_shader=MESH_VERT,fragment_shader=MESH_FRAG)
  self.meshvao=self.make_shards(rng)
  self.ctx.enable(moderngl.PROGRAM_POINT_SIZE)
  self.title_cache={}
  for x in self.timeline:self.layouts[x['id']]=self.make_layout(x)
 def make_shards(self,rng):
  from scipy.spatial import ConvexHull
  out=[]
  for i in range(100):
   points=rng.normal(size=(12,3));points/=np.maximum(np.linalg.norm(points,axis=1,keepdims=True),.001)
   points*=rng.uniform(.10,.45)*np.array([1,1.7,.7])
   hull=ConvexHull(points);seed=rng.random(4)
   # Protect the lyric focal area; flying geometry is weighted to the sides.
   if abs(seed[0]-.5)<.17:seed[0]=.14 if seed[0]<.5 else .86
   for tri in hull.simplices:
    a,b,c=points[tri];normal=np.cross(b-a,c-a);normal/=max(np.linalg.norm(normal),.0001)
    for v in [a,b,c]:out.append([*v,*normal,*seed])
  return self.ctx.simple_vertex_array(self.meshprog,self.ctx.buffer(np.array(out,dtype='f4').tobytes()),'position','normal','seed')
 def font(self,kind,size):
  key=(kind,size)
  if key not in self.fonts:
   fn={'gothic':'Cinzel.ttf','modern':'BarlowCondensed-SemiBold.ttf','delicate':'CormorantGaramond-Italic.ttf'}[kind]
   self.fonts[key]=ImageFont.truetype(str(ROOT/'assets'/fn),size)
  return self.fonts[key]
 def glyph(self,text,kind,size,tracking=0):
  key=(text,kind,size,tracking)
  if key in self.cache:return self.cache[key]
  f=self.font(kind,size);bb=f.getbbox(text);wid=round(f.getlength(text)+(len(text)-1)*tracking)+24;hei=size+36
  im=Image.new('RGBA',(max(2,wid),hei));d=ImageDraw.Draw(im)
  metric=f.getbbox('Hgj',anchor='ls');baseline=(hei-(metric[3]-metric[1]))/2-metric[1]
  if tracking:
   px=12
   for c in text:d.text((px,baseline),c,font=f,fill=(255,255,255,255),anchor='ls');px+=f.getlength(c)+tracking
  else:d.text((12,baseline),text,font=f,fill=(255,255,255,255),anchor='ls')
  tex=self.ctx.texture(im.size,4,im.tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR)
  self.cache[key]=(tex,wid,hei);return self.cache[key]
 def draw(self,glyph,x,y,alpha=1,scale=1,color=(.95,.95,.94),rotation=0,dissolve=-.2,reveal=1.2,fracture=0):
  if alpha<=.001:return
  tex,w,h=glyph;tex.use(0)
  p=self.sprite;p['box']=(x*self.s,y*self.s,w*scale*self.s,h*scale*self.s);p['color']=(*color,float(alpha));p['rotation']=rotation;p['dissolve']=float(dissolve);p['reveal']=float(reveal);p['phase']=float(self.t*17);p['fracture']=float(fracture)
  self.svao.render(moderngl.TRIANGLE_STRIP)
 def make_layout(self,line):
  text=line['text'];words=text.split();low=text.lower();chorus=low.startswith('i know how to slay my');short=low=='my demons'
  gentle=any(w in low for w in ['freedom','destiny','teary','sunshine','why did','where did','advice','room to fall','tangled','brush'])
  kind='delicate' if gentle else 'modern'
  size=92 if not gentle else 94
  if 'ancient' in low or 'redemption' in low:kind='gothic';size=70
  rows=[words]
  if chorus:rows=[words[:-2],words[-2:]]
  if len(text)>36 and not chorus:size=80 if not gentle else 86
  if short:kind='gothic';size=142
  result=[];idx=0
  for r,row in enumerate(rows):
   rk='modern' if chorus and r==0 else ('gothic' if chorus else kind);rs=(60 if r==0 else 142) if chorus else size
   while True:
    glyphs=[self.glyph(w.upper() if rk!='delicate' else w,rk,rs) for w in row]
    gap=rs*.23;width=sum(g[1]-24 for g in glyphs)+gap*(len(row)-1)
    if width<=1560:break
    rs-=2
   x=960-width/2
   yy=(728 if r==0 else 835) if chorus else (812 if gentle else 800)
   for w,g in zip(row,glyphs):
    result.append({'word':idx,'glyph':g,'x':x+(g[1]-24)/2,'y':yy,'font':rk});x+=g[1]-24+gap;idx+=1
  return result
 def typography(self,t,shot):
  active=[x for x in self.timeline if x['start']-.08<=t<=x['end']]
  for line in active:
   age=t-line['start'];tail=line['end']-t;dur=line['end']-line['start'];low=line['text'].lower()
   fade=smooth((age+.08)/.14)*smooth(tail/.16)
   chorus='demons' in low
   # Words arrive with the measured performance. Very fast speech uses a compact phrase reveal.
   for d in self.layouts[line['id']]:
    wi=d['word'];ww=line['words'][min(wi,len(line['words'])-1)]
    delay=min(wi*.03,.18)
    if len(self.layouts[line['id']])>5 and low.startswith('i know how to slay my') and wi>=5:delay=max(0,line['words'][5]['start']-line['start'])+(wi-5)*.05
    wa=t-(line['start']+delay)
    enter=smooth((wa+.04)/.17)
    if enter<=0:continue
    highlight=smooth((t-ww['start'])/.08)*(1-smooth((t-ww['end']-.1)/.5))
    y=d['y']+(1-enter)*16
    color=(.91+highlight*.08,.91+highlight*.05,.90+highlight*.02)
    frac=0
    if chorus and tail<.22:frac=(1-tail/.22)*.45
    if 'crossed' in low and self.impact>.65:frac=.24
    self.draw(d['glyph'],d['x']+2,y+3,fade*enter*.8,color=(0,0,0),scale=1.012)
    # A single restrained spectral echo on vulnerable words.
    if d['font']=='delicate':self.draw(d['glyph'],d['x']+8,y+2,fade*enter*.075,color=(.5,.63,.7))
    self.draw(d['glyph'],d['x'],y,fade*enter,color=color,fracture=frac)
  # Official titles stay inside existing instrumental time.
  if 4<t<21:
   a=smooth((t-4)/3)*smooth((21-t)/2.2)
   self.draw(self.glyph('S W A N','gothic',40,3),960,404,a*.92)
   self.draw(self.glyph('DEMONS','gothic',188,6),960,548,a,reveal=smooth((t-4)/4)*1.3)
  if 29<t<39:
   a=smooth((t-29)/1.3)*smooth((39-t)/1.5)
   self.draw(self.glyph('Music and Video: Carl Korytko','modern',42),960,847,a*.87)
  if 41<t<51:
   a=smooth((t-41)/1.4)*smooth((51-t)/1.5)
   self.draw(self.glyph('Lyrics and Spoken Word: #WEED_SMOK','modern',40),960,847,a*.87)
  if 354.8<t<367.7:
   a=smooth((t-354.8)/1.9)*smooth((367.7-t)/1.7)
   self.draw(self.glyph('DEMONS','gothic',98,5),960,350,a)
   self.draw(self.glyph('S W A N','gothic',39,4),960,453,a*.95)
   self.draw(self.glyph('Music and Video by Carl Korytko','modern',44),960,735,a*.91)
   self.draw(self.glyph('Lyrics and Spoken Word by #WEED_SMOK','modern',40),960,805,a*.91)
 def frame_at(self,t):
  self.t=t
  si=next((i for i,s in enumerate(self.shots) if s[0]<=t<s[1]),len(self.shots)-1);shot=self.shots[si]
  start,end,plate,label,zoom,direction,red,rain,fog,mode=shot
  p=(t-start)/max(end-start,.01)
  transition=0
  prev=plate
  if si and t-start<.75:
   prev=self.shots[si-1][2];transition=1-smooth((t-start)/.75)
  ii=min(len(self.audio['curves']['bass'])-1,max(0,round(t*30)))
  get=lambda k:float(self.audio['curves'][k][ii])
  bass=get('bass');energy=get('rms');onset=get('onset')
  self.impact=max(0.,onset-.25)
  pulse=self.impact if mode in [1,2,3,4,7,8,10] else 0
  warm=.5 if plate==7 else (.12 if t>294 else 0)
  black=smooth(t/2.3)*smooth((368.066667-t)/1.35)
  self.low.use();self.ctx.disable(moderngl.BLEND)
  self.plates[plate].use(0);self.plates[prev].use(1);self.noise.use(2)
  params={'time':t,'localTime':t-start,'progress':p,'blendAmount':transition,'energy':energy,'bass':bass,'impact':pulse,'warmth':warm,'red':red,'rain':rain,'fog':fog,'zoom':zoom,'direction':direction,'blackout':black,'glitch':(.35*max(0,onset-.7) if mode==4 else 0),'solo':float(mode==7),'effectMode':float(mode)}
  for name,value in params.items():
   if name in self.bg:self.bg[name]=float(value)
  self.bgvao.render(moderngl.TRIANGLE_STRIP)
  self.frame.use();self.low.color_attachments[0].use(0);self.copyvao.render(moderngl.TRIANGLE_STRIP)
  self.ctx.enable(moderngl.BLEND);self.ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA)
  if mode in [7,10,3]:
   mp=self.meshprog;mp['time']=t;mp['amount']=(.9 if mode==7 else (.48 if mode==10 else .26))*black;mp['aspect']=self.w/self.h;mp['travel']=.025 if mode==7 else .004;mp['red']=red;mp['light']=bass+onset*.3
   self.meshvao.render(moderngl.TRIANGLES)
  pp=self.pprog;pp['time']=t;pp['intensity']=(.65 if mode in [5,11] else 1.1)*black;pp['flow']=float(mode in [7,10]);pp['scale']=self.s;pp['warmth']=warm+red*.3;self.pvao.render(moderngl.POINTS)
  self.typography(t,shot)
  return self.frame.read(components=3,alignment=1)
 def still(self,t,path):
  Image.frombytes('RGB',(self.w,self.h),self.frame_at(t)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(path)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--width',type=int,default=1920);ap.add_argument('--height',type=int,default=1080);ap.add_argument('--start',type=float,default=0);ap.add_argument('--duration',type=float,default=368.066667);ap.add_argument('--fps',type=int,default=30);ap.add_argument('--output',default='output/DEMONS_SWAN_picture.mp4');ap.add_argument('--stills',nargs='*',type=float);args=ap.parse_args()
 v=Video(args.width,args.height)
 if args.stills:
  for t in args.stills:v.still(t,ROOT/f'frame_{t:g}.jpg')
  return
 out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
 log=open(ROOT/'ffmpeg_picture.log','w')
 cmd=['ffmpeg','-y','-v','warning','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{args.width}x{args.height}','-framerate',str(args.fps),'-i','pipe:0','-vf','vflip','-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(out)]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log);frames=math.ceil(args.duration*args.fps-1e-5);beg=time.monotonic()
 try:
  for i in range(frames):
   proc.stdin.write(v.frame_at(args.start+i/args.fps))
   if i%150==0:print(f'{i}/{frames} {i/max(time.monotonic()-beg,.01):.2f} fps elapsed={time.monotonic()-beg:.1f}s',flush=True)
 finally:proc.stdin.close()
 code=proc.wait();print('Complete',str(out),'status',code,'seconds',time.monotonic()-beg,flush=True)
 if code:raise SystemExit(code)
if __name__=='__main__':main()
