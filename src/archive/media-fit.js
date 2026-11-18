// Геометрия медиаграни имеет отношение сторон 5.8 / 4.6.
export const MEDIA_FRAME_ASPECT=5.8/4.6;
export function mediaFit(aspect,mode='cover') {
  if(!Number.isFinite(aspect)||aspect<=0)aspect=MEDIA_FRAME_ASPECT;
  if(mode==='contain')return {scaleX:Math.min(1,aspect/MEDIA_FRAME_ASPECT),scaleY:Math.min(1,MEDIA_FRAME_ASPECT/aspect),repeatX:1,repeatY:1};
  return {scaleX:1,scaleY:1,repeatX:Math.min(1,MEDIA_FRAME_ASPECT/aspect),repeatY:Math.min(1,aspect/MEDIA_FRAME_ASPECT)};
}

// Точка кадрирования в [0,1]; не позволяет выбрать область вне текстуры.
export function mediaOffset(fit,x=.5,y=.5) {
  const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):.5;
  return {x:(1-fit.repeatX)*clamp(x),y:(1-fit.repeatY)*clamp(y)};
}
