"""Original 48 second instrumental; no third-party audio. Python stdlib only."""
import wave, math, struct
rate=22050
with wave.open('public/assets/demo.wav','wb') as out:
 out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate)
 for i in range(48*rate):
  t=i/rate; beat=t%.5; chord=[110,87.307,130.813,97.999][int(t//6)%4]
  pad=sum(math.sin(2*math.pi*chord*r*t)*.045 for r in [1,1.5,2,3])*min(t/2,1)*min((48-t)/3,1)
  kick=math.sin(2*math.pi*(50*beat+30*(1-math.exp(-beat*35))/35))*math.exp(-beat*20)*.32
  pluck=math.sin(2*math.pi*chord*4*t)*math.exp(-(t%.25)*18)*.07
  signal=(pad+kick+pluck)*min(t*2,1)*min((48-t)*2,1)
  out.writeframesraw(struct.pack('<h',int(max(-1,min(1,signal))*26000)))
