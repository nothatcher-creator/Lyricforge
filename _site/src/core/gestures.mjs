export function pinchValue(startValue,startDistance,currentDistance,min=.25,max=4){
  const base=Number(startValue)||1,a=Math.max(1,Number(startDistance)||1),b=Math.max(1,Number(currentDistance)||1);
  return Math.max(min,Math.min(max,base*b/a));
}
export function touchDistance(touches){if(!touches||touches.length<2)return 0;return Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);}
