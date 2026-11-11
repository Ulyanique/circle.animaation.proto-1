/** Абсолютное время финала: тот же результат при воспроизведении и перемотке. */
export const FINAL_LIGHT_START=-.8;
export const FINAL_LIGHT_ARRIVAL=1.85;
const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function finalLightPoint(local,start) {
  // После встречи со знаком свет продолжает спокойный полёт, а не исчезает.
  if(local>FINAL_LIGHT_ARRIVAL){
    const u=ease((local-FINAL_LIGHT_ARRIVAL)/(8.2-FINAL_LIGHT_ARRIVAL));
    return {x:960+410*u,y:335+225*u-55*Math.sin(Math.PI*u)};
  }
  const u=ease((local-FINAL_LIGHT_START)/(FINAL_LIGHT_ARRIVAL-FINAL_LIGHT_START));
  // Финал соединён с проекцией 3D-точки; путь мягко приходит к верхней части знака.
  const a=start||{x:250,y:570},d={x:960,y:335};
  const b={x:a.x+(d.x-a.x)*.27,y:a.y-125},c={x:d.x-180,y:d.y+105};
  const v=1-u;
  return {x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,
    y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y};
}
export function finaleState(local) {
  return {fade:ease((local+.8)/1.25),logo:ease((local-.75)/1.35),title:ease((local-2.5)/1.15),
    light:1,closing:ease((local-8.2)/.8)};
}
