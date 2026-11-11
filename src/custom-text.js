/** Восемь независимых текстовых слотов в каждой сцене. Ключи плоские для точечной истории. */
export const CUSTOM_TEXT_IDS = Array.from({ length: 8 }, (_, i) => `text${i + 1}`);
export function customTextDefaults() {
  const values = {};
  for (const [index, id] of CUSTOM_TEXT_IDS.entries()) Object.assign(values, {
    [`${id}Name`]: '', [`${id}Present`]: false, [`${id}Visible`]: true, [`${id}Order`]: index, [`${id}Text`]: 'Новый текст',
    [`${id}Color`]: '#ecd08c', [`${id}X`]: 0, [`${id}Y`]: 0.25, [`${id}Scale`]: 1, [`${id}AutoFit`]: false, [`${id}Tracking`]: 0, [`${id}Font`]: '', [`${id}Case`]: 'none', [`${id}Opacity`]: 1, [`${id}RevealStyle`]: 'draw',
    [`${id}TimingMode`]: 'scene', [`${id}Start`]: 25, [`${id}End`]: 90, [`${id}Fade`]: 15,
  });
  return values;
}
/** @param {string} id */
export const customTextKeys = id => ['Name', 'Present', 'Visible', 'Order', 'Text', 'Color', 'X', 'Y', 'Scale', 'AutoFit', 'Tracking', 'Font', 'Case', 'Opacity', 'RevealStyle', 'TimingMode', 'Start', 'End', 'Fade'].map(suffix => `${id}${suffix}`);

/** Порядок от заднего плана к переднему. Неизвестные значения берут исходный номер слота.
 * @param {Record<string, any> | undefined} config @param {boolean} [presentOnly] */
export function customTextOrder(config, presentOnly = false) {
  return CUSTOM_TEXT_IDS.filter(id => !presentOnly || config?.[`${id}Present`] === true).sort((a, b) => {
    const ai = CUSTOM_TEXT_IDS.indexOf(a), bi = CUSTOM_TEXT_IDS.indexOf(b);
    const aValue = config?.[`${a}Order`], bValue = config?.[`${b}Order`];
    const av = Number.isFinite(aValue) ? aValue : ai;
    const bv = Number.isFinite(bValue) ? bValue : bi;
    return av - bv || ai - bi;
  });
}
/** Правки для помещения нового текста впереди, включая нормализацию экстремальных импортированных чисел.
 * @param {Record<string, any>} config @param {string} id */
export function customTextInsertion(config, id) {
  const present = customTextOrder(config, true);
  const max = present.length ? Math.max(...present.map(key => {
    const value = config[`${key}Order`];
    return Number.isFinite(value) ? value : CUSTOM_TEXT_IDS.indexOf(key);
  })) : -1;
  const normalize = max >= Number.MAX_SAFE_INTEGER - 8 || max + 1 === max;
  const changes = normalize ? present.map((key, value) => ({section: 'textLayers', key: `${key}Order`, value})) : [];
  changes.push({section: 'textLayers', key: `${id}Order`, value: normalize ? present.length : max + 1});
  return changes;
}
/** Поменять выбранную надпись с соседней; результат — нормализованные точечные правки.
 * @param {Record<string, any>} config @param {string} id @param {"front" | "back"} direction */
export function customTextReorder(config, id, direction) {
  const order = customTextOrder(config, true), index = order.indexOf(id);
  const target = index + (direction === 'front' ? 1 : -1);
  if (index < 0 || target < 0 || target >= order.length) return [];
  [order[index], order[target]] = [order[target], order[index]];
  return order.map((key, value) => ({section: 'textLayers', key: `${key}Order`, value}));
}

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

/** Режим проявления меняет визуальную маску, но не тайминг или исходную строку.
 * @param {{outline:number, fill?:number}} line @param {unknown} style */
export function customTextVisual(line, style) {
  if (style !== 'fade' && style !== 'fade-up') return {line, opacity:1, fade:false};
  const opacity = Number.isFinite(line.outline) ? Math.max(0, Math.min(1, line.outline)) : 0;
  return {line:{outline:1, fill:1}, opacity, fade:true, rise: style === 'fade-up' ? 0.8 * (1 - opacity) : 0};
}
