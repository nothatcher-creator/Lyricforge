#version 330
uniform sampler2D plateA;
uniform sampler2D plateB;
uniform sampler2D noiseTex;
uniform float time;
uniform float localTime;
uniform float progress;
uniform float blendAmount;
uniform float energy;
uniform float bass;
uniform float impact;
uniform float warmth;
uniform float red;
uniform float rain;
uniform float fog;
uniform float zoom;
uniform float direction;
uniform float blackout;
uniform float glitch;
uniform float solo;
uniform float effectMode;
in vec2 uv;
out vec4 fragColor;
float n(vec2 p){return texture(noiseTex,p/256.).r;}
float fbm(vec2 p){return n(p)*.56+n(p*2.03+8.)*.28+n(p*4.07-4.)*.16;}
vec3 plate(sampler2D tx,vec2 v){
 float depth=pow(abs(v.y-.47)*2.,1.3);
 vec2 drift=vec2(direction*(progress-.5)*.028,sin(progress*3.14159)*.008);
 vec2 p=(v-.5)/(zoom+progress*.055)+.5+drift*(.3+depth);
 // Slow displacement lives in the atmosphere rather than shaking the camera.
 float atmospheric=smoothstep(.58,.83,v.y)*(1.-smoothstep(.88,1.,v.y));
 p.x+=sin(v.y*18.+time*.13)*.0011*atmospheric;
 p+=vec2(sin(time*.17),cos(time*.13))*.0014*depth;
 return texture(tx,clamp(p,.002,.998)).rgb;
}
void main(){
 vec2 v=vec2(uv.x,1.-uv.y);
 float sh=(n(vec2(floor(v.y*140.),floor(time*14.)))-.5)*glitch*.023;
 vec2 q=v+vec2(sh,0);
 vec3 col=mix(plate(plateA,q),plate(plateB,q),blendAmount);
 // Soft drifting fog across several apparent depths.
 float near=fbm(vec2(v.x*190.+time*2.3,v.y*115.-time*.7));
 float far=fbm(vec2(v.x*95.-time*.8,v.y*80.+time*.4));
 float mist=pow(max(0.,near-.28),2.)*smoothstep(.30,.90,v.y);
 col=mix(col,vec3(.24,.30,.35),mist*fog*.48);
 col+=vec3(.052,.07,.09)*pow(max(0.,far-.40),2.)*fog;
 // Selective music light pulse, intentionally low amplitude.
 col*=.91+energy*.095+bass*.035+impact*.075;
 col+=vec3(.19,.025,.045)*red*pow(max(0.,near-.42),2.);
 col=mix(col,col*vec3(1.09,1.02,.90)+vec3(.018,.012,.003),warmth);
 // Sparse rain in perspective; never sits on the typography pass.
 if(rain>.01){
  vec2 ruv=vec2(v.x*640.+v.y*48.,v.y*20.+time*26.);
  vec2 cell=floor(ruv);vec2 f=fract(ruv);
  float seed=n(vec2(cell.x*17.,4.));
  float drop=pow(max(0.,1.-abs(f.x-.5)*28.),3.)*smoothstep(.12,.85,f.y)*step(.81,seed);
  col+=drop*rain*mix(vec3(.3,.38,.44),vec3(.33,.05,.065),red)*.5;
 }

 // Ghost forms are light-starved wisps, never literal monsters.
 if(effectMode==1. || effectMode==10.){
  float release=effectMode==10.?smoothstep(333.5,340.5,time):0.;
  float ghosts=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);vec2 c=vec2(.21+fi*.29+sin(time*.12+fi*3.)*.035,.41+sin(time*.21+fi)*.025);
   vec2 g=(v-c)/vec2(.065,.23);
   float body=exp(-g.x*g.x*2.5)*smoothstep(-1.1,-.4,g.y)*(1.-smoothstep(.35,1.2,g.y));
   float head=exp(-dot((v-c-vec2(0,-.12))/vec2(.025,.037),(v-c-vec2(0,-.12))/vec2(.025,.037))*2.);
   ghosts+=(body*.65+head)*smoothstep(.25,.66,near)*(1.-release);
  }
  col*=1.-ghosts*.28;
 }
 // Broken ritual arcs turn in shallow three-dimensional perspective.
 if(effectMode==3. || effectMode==7.){
  vec2 rp=(v-vec2(.5,.43))*vec2(1.,1.9);float rr=length(rp);float ang=atan(rp.y,rp.x)+time*.08;
  float rings=exp(-abs(rr-.235)*1500.)*.36+exp(-abs(rr-.262)*1500.)*.18;
  float marks=step(.88,fract(ang*18./6.283185))*smoothstep(.217,.225,rr)*(1.-smoothstep(.237,.242,rr));
  col+=vec3(.32,.12,.10)*(rings+marks*.26)*(.6+bass*.2);
 }
 // The crossed wires spark only on stronger transients.
 if(effectMode==4.){
  float path=.37+.08*sin(v.x*29.+floor(time*12.))+ .025*sin(v.x*93.);
  float arc=exp(-abs(v.y-path)*650.)*smoothstep(.18,.28,v.x)*(1.-smoothstep(.72,.82,v.x));
  col+=vec3(.48,.56,.67)*arc*max(0.,impact-.25)*.75;
 }
 if(effectMode==7.){
  float strike=pow(max(0.,sin(time*2.71)),36.)*max(0.,impact-.4);
  col+=vec3(.12,.15,.20)*strike;
 }

 // Subtle film texture, optical falloff and a protected lower title area.
 float vignette=1.-.38*pow(length((v-.5)*vec2(1.18,1.)),1.3);
 col*=vignette;
 col*=1.-smoothstep(.5,.96,v.y)*.40;
 float grain=n(vec2(v.x*1920.,v.y*1080.)+vec2(floor(time*24.)*13.7,0.))-.5;
 col+=grain*.014;
 col*=blackout;
 fragColor=vec4(clamp(col,0.,1.),1.);
}
