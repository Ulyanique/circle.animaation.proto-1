// Локальные координаты медиаграни, рассчитанные от мировой точки источника.
// Без зависимости от предыдущего кадра: перемотка и пауза дают тот же блик.
export function mediaLight(x,y,z,visibility=1) {
  const falloff=Math.max(0,1-Math.abs(z)/7);
  return {x:(x+2.9)/5.8,y:(y+2.3)/4.6,strength:.14*falloff*Math.max(0,Math.min(1,visibility))};
}
