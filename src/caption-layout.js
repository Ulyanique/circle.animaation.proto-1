/** Смещение титра привязано к высоте кадра, не к размеру окна браузера.
 * @param {number} progress Плавная огибающая появления от 0 до 1.
 * @param {number} centered Переход финальной строки к центру от 0 до 1.
 * @param {number} frameHeight Высота рамки предпросмотра в CSS-пикселях. */
export function captionDrift(progress, centered, frameHeight) {
  return (1 - progress) * (1 - centered) * frameHeight * .008;
}

/** Небольшая посадка штатного названия в интро, в единицах --u.
 * Вход длится столько же, сколько штатное проявление строки. Перед выходом
 * смещение гарантированно сводится к нулю даже при коротком удержании.
 * @param {{local:number,beforeStart:boolean}} phase
 * @param {{drawDuration:number,emergeDuration:number,holdDuration:number}} timeline
 * @param {number} captionStart @param {boolean} enabled */
export function introTitleLanding(phase, timeline, captionStart, enabled) {
  if (!enabled || phase.beforeStart || phase.local < captionStart) return 0;
  const smooth = x => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const exit = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration;
  const entrance = 1 - smooth((phase.local - captionStart) / .88);
  const beforeExit = 1 - smooth((phase.local - (exit - .2)) / .2);
  // Ровно в конце посадки смещение обязано быть нулём, а не 1e-15: иначе
  // проверка «посадка закончилась» ловит плавающий хвост, а сдвиг на тысячную
  // пикселя всё равно не виден.
  const value = .75 * entrance * beforeExit;
  return value < 1e-9 ? 0 : value;
}
