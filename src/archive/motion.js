import {ARCHIVE_SLOTS} from './slots.js';
/** Все параметры декоративной сцены вычисляются от абсолютного времени. */
export const SLOT_DURATION = 8;
export const MEDIA_SURFACE_SCALE = 1.5;
export const SLOT_COUNT = ARCHIVE_SLOTS.length;
export const FINALE_START = SLOT_COUNT * SLOT_DURATION;
export const FINALE_DURATION = 9;
export const ARCHIVE_DURATION = FINALE_START + FINALE_DURATION;
/** @param {number} t */
export function wrapTime(t) { return ((Math.max(0, Number.isFinite(t) ? t : 0) % ARCHIVE_DURATION) + ARCHIVE_DURATION) % ARCHIVE_DURATION; }
// Камера продолжает лететь вперёд, но мягко проходит по разным высотам
// и обходит каждую медиагрань со свободной стороны.
const PANEL_SIDES=[-1,1,-1,-1,1,-1,1,1,-1,1];
/** @param {number} t */
export function archiveMotion(t) {
  const time=wrapTime(t);
  const cameraZ=8-time*1.5-.35*Math.sin(time*Math.PI*2/SLOT_DURATION);
  const phase=(time-9.3333333333)/SLOT_DURATION;
  const index=Math.max(0,Math.min(SLOT_COUNT-1,Math.floor(phase)));
  const blend=smooth(phase-index), a=ARCHIVE_PANELS[index],b=ARCHIVE_PANELS[Math.min(index+1,SLOT_COUNT-1)];
  const approach=-.85*(a.side+(b.side-a.side)*blend);
  const arc=phase>=0 ? .36*a.side*Math.sin(Math.PI*Math.max(0,Math.min(1,phase-index)))**2 : 0;
  // Первая грань сразу попадает в композицию; до её пересечения камера
  // постепенно переходит на свободную сторону. Дальше — мягкие дуги.
  const x=phase<0 ? a.side*.65+(approach-a.side*.65)*smooth(time/9.3333333333) : approach+arc;
  const y=1.15*Math.sin(time*.21+.2);
  const slot=Math.min(SLOT_COUNT-1,Math.floor(time/SLOT_DURATION));
  const local=time-slot*SLOT_DURATION;
  const envelope=smooth((local-.5)/2.7)*(1-smooth((local-5)/3));
  const fov=50-[5,-3,5,-2,4,-3,5,-3,4,-2][slot]*envelope;
  // Небольшие плавные отклонения взгляда — не разворот к стене.
  const yaw=.06*Math.sin(time*.19)-.025,pitch=.05*Math.sin(time*.16+.4);
  return {time,progress:time/ARCHIVE_DURATION,cameraX:x,cameraY:y,cameraZ,
    lookX:x+12*Math.tan(yaw),lookY:y+12*Math.tan(pitch),lookZ:cameraZ-12,roll:0,fov};
}
// Изображения расположены по бокам свободного пути, не перекрывая пролёт.
export const ARCHIVE_PANELS = ARCHIVE_SLOTS.map((_,i)=>{
  const side=PANEL_SIDES[i%PANEL_SIDES.length];
  return {side,x:side*4.8,ry:-side*.16,rz:side*.025,z:-6-i*12};
});
/** @param {number} x */
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** Наложение соседних сцен, вместо включения и выключения одним кадром.
 * @param {number} time @param {number} slot */
export function panelOpacity(time, slot) {
  const local=time-slot*SLOT_DURATION;
  const enter=slot===0 ? 1 : smooth((local+2.5)/2);
  const exit=1-smooth((local-5)/2.8);
  return enter*exit;
}
// Змееобразный источник движется вперёд независимо от угла камеры.
/** @param {number} time @returns {[number, number, number]} */
export function archiveLightPosition(time) {
  const t=Number.isFinite(time)?time:0;
  // В момент пролёта изображения источник находится с противоположной
  // стороны прохода; между изображениями он плавно меняет сторону.
  const phase=(t-4.6666666667)/SLOT_DURATION;
  const i=Math.max(0,Math.min(SLOT_COUNT-1,Math.floor(phase)));
  const blend=smooth(phase-i), a=ARCHIVE_PANELS[i], b=ARCHIVE_PANELS[Math.min(i+1,SLOT_COUNT-1)];
  const x=-1.25*(a.side+(b.side-a.side)*blend)+.15*Math.sin(t*.55);
  return [x,1.15*Math.sin(t*.21+.2)+.8*Math.sin(t*.37+.5),1-1.5*t];
}
/** Во время входного растворения удерживаем первый кадр; видео стартует с эпизодом.
 * @param {number} t @param {number} slot */
export function videoElapsedForSlot(t, slot) {
  return Math.max(0,wrapTime(t)-slot*SLOT_DURATION);
}
/** Короткий фрагмент удерживается на последнем кадре, без скачка на начало.
 * @param {number} t @param {number} slot @param {number} duration */
export function videoTimeForSlot(t, slot, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(videoElapsedForSlot(t,slot),Math.max(0,duration-1/30));
}
