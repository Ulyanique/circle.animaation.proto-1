/** Восемь независимых текстовых слотов в каждой сцене. Ключи плоские для точечной истории. */
export const CUSTOM_TEXT_IDS = Array.from({ length: 8 }, (_, i) => `text${i + 1}`);
export function customTextDefaults() {
  const values = {};
  for (const id of CUSTOM_TEXT_IDS) Object.assign(values, {
    [`${id}Present`]: false, [`${id}Visible`]: true, [`${id}Text`]: 'Новый текст',
    [`${id}Color`]: '#ecd08c', [`${id}X`]: 0, [`${id}Y`]: 0.25, [`${id}Scale`]: 1,
    [`${id}TimingMode`]: 'scene', [`${id}Start`]: 25, [`${id}End`]: 90, [`${id}Fade`]: 15,
  });
  return values;
}
/** @param {string} id */
export const customTextKeys = id => ['Present', 'Visible', 'Text', 'Color', 'X', 'Y', 'Scale', 'TimingMode', 'Start', 'End', 'Fade'].map(suffix => `${id}${suffix}`);

/** Интервал в процентах от цикла (после startDelay). Возвращает те же маски,
 * что и обычный титр, без зависимости от предыдущих кадров.
 * @param {number} time
 * @param {{startDelay:number, drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} timeline
 * @param {Record<string, any>} config
 * @param {string} id */
export function customTextAnimation(time, timeline, config, id) {
  /** @param {number} n @param {number} min @param {number} max */
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  /** @param {unknown} value @param {number} fallback */
  const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const start = clamp(number(config[`${id}Start`], 25), 0, 99) / 100;
  const end = Math.max(start + 0.01, clamp(number(config[`${id}End`], 90), 1, 100) / 100);
  const fade = clamp(number(config[`${id}Fade`], 15), 5, 50) / 100;
  const cycle = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration + timeline.fadeDuration + timeline.restDuration;
  if (!Number.isFinite(time) || !(cycle > 0) || time < timeline.startDelay) return { outline: 0, fill: 0 };
  const p = (((time - timeline.startDelay) % cycle) + cycle) % cycle / cycle;
  const width = (end - start) * fade;
  /** @param {number} a @param {number} b @param {number} x */
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const exit = 1 - smooth(end - width, end, p);
  return { outline: smooth(start, start + width * 0.65, p) * exit,
    fill: smooth(start + width * 0.35, start + width, p) * exit };
}
