/** Углы знака в сценах. В фотопаузе скорость вращения не зависит от длительности удержания.
 * @param {{intro:boolean, photo:boolean, time:number, local:number, cycle:number, start?:number, turns?:number, swayAmount:number, swaySpeed:number}} p */
export function logoRotation(p) {
  if (p.intro) return { x: 0, y: 0, z: 0 };
  if (p.photo) {
    const turns = typeof p.turns === 'number' && Number.isFinite(p.turns) ? Math.max(-3, Math.min(3, Math.round(p.turns))) : 1;
    const cycle = Number.isFinite(p.cycle) && p.cycle > 0 ? p.cycle : 1;
    const start = typeof p.start === 'number' && Number.isFinite(p.start) ? Math.max(0, Math.min(cycle - .001, p.start)) : 0;
    const duration = cycle - start;
    const ramp = Math.min(.8, duration / 2);
    const elapsed = Math.max(0, Math.min(duration, p.local - start));
    // Интеграл smootherstep: плавно набираем скорость без рывка в момент завершения обводки.
    const u = Math.min(1, elapsed / ramp);
    const distance = elapsed < ramp ? ramp * (u ** 6 - 3 * u ** 5 + 2.5 * u ** 4) : elapsed - ramp / 2;
    return { x: 0, y: Math.PI * 2 * turns * distance / 20, z: 0 };
  }
  /** @param {number} f */
  const quant = f => f <= 0 ? 0 : Math.max(1, Math.round(f * p.cycle)) / p.cycle;
  return { x: Math.cos(Math.PI * 2 * quant(p.swaySpeed * .7) * p.time + 1) * p.swayAmount * .6,
    y: Math.sin(Math.PI * 2 * quant(p.swaySpeed) * p.time) * p.swayAmount, z: 0 };
}
