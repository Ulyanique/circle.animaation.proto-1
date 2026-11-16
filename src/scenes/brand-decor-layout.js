// Единичная окружность: размер задаётся масштабом группы в сцене.
const TAU = Math.PI * 2;

/** Возвращает риски и детерминированную орбитальную пыль. */
export function brandDecorLayout(tickCount = 48, dustCount = 72) {
  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const a = TAU * i / tickCount;
    const c = Math.cos(a), s = Math.sin(a);
    const length = i % 4 === 0 ? 0.06 : 0.025;
    ticks.push(c * (1 - length), s * (1 - length), 0, c, s, 0);
  }
  // Равномерно рассеянные, но воспроизводимые точки; без зависимости от RAF.
  let seed = 1234567;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dust = [];
  for (let i = 0; i < dustCount; i++) {
    const a = random() * TAU;
    const r = 0.965 + random() * 0.07;
    dust.push(Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  return { ticks: new Float32Array(ticks), dust: new Float32Array(dust) };
}
