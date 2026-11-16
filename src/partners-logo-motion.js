// Все параметры выводятся из времени/огибающих, без накопления состояния.
const clamp = x => Math.max(0, Math.min(1, x));

export function partnersLogoMotion(entry, time, drawDuration, index, motion = 1) {
  const p = clamp(entry);
  const enabled = clamp(Number.isFinite(motion) ? motion : 1);
  // Блик начинается после завершения индивидуального проявления, даже при
  // изменении продолжительности прорисовки в настройках.
  const ends = [1.5, 1.8, 2.3, 2.55];
  const delay = Math.max(.25, drawDuration) * ends[index] + .45 + index * .18;
  const elapsed = time - delay;
  const sweep = elapsed < 0 || enabled === 0 ? -1 : (elapsed % 9) / 2.2;
  return {
    opacity: clamp(p * 2.5),
    scale: 1 - .025 * (1-p),
    offsetY: 12 * (1-p),
    reveal: p,
    sweep: sweep >= 0 && sweep < 1 ? sweep : -1,
    glintOpacity: enabled * .7,
  };
}
