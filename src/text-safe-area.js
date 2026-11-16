/**
 * Безопасная зона текста относительно занавеса.
 *
 * Занавес — передний план: он висит поверх рамки и закрывает левую кромку кадра.
 * Ткань не заканчивается резко, у неё полупрозрачная складка, поэтому «текст не
 * под шторой» нельзя проверять по одному краю PNG: нужно знать, на какой
 * колонке ткань становится плотной.
 *
 * Замер по `shtora.png` (476×1080, альфа по колонкам): непрозрачно до x≈240,
 * плотнее половины — до x≈372, полупрозрачный хвост — до x≈440. Ширина шторы
 * настраивается, поэтому порог хранится в долях её ширины и пересчитывается.
 */
export const CURTAIN_OPAQUE_SHARE = 0.50;
export const CURTAIN_SOLID_SHARE = 0.78;

/** Качание шторы в пике: +8 px при полной интенсивности движения (старшая сцена). */
export const CURTAIN_SWAY_PEAK = 9;

/**
 * Правая граница безопасной зоны в координатах кадра.
 * @param {{curtainVisible?:boolean, curtainWidth?:number}} settings
 * @param {{sway?:number}} [options] смещение ткани от качания в пике
 */
export function textSafeLeft(settings, { sway = CURTAIN_SWAY_PEAK } = {}) {
  if (!settings || settings.curtainVisible === false) return 0;
  const width = Number.isFinite(settings.curtainWidth) ? settings.curtainWidth : 476;
  // Берём плотную часть ткани, а не весь PNG: полупрозрачный хвост складки
  // текст не «съедает», но и подходить к нему вплотную не надо.
  return width * CURTAIN_SOLID_SHARE + Math.abs(sway);
}

/**
 * Влезает ли строка в безопасную зону. Ширина задана центром и полной шириной.
 * @param {{width:number, center?:number}} line
 * @param {number} safeLeft левая граница зоны в координатах кадра
 * @param {number} [margin] запас до ткани, px
 */
export function fitsSafeArea(line, safeLeft, margin = 24) {
  const center = Number.isFinite(line.center) ? line.center : 960;
  const left = center - line.width / 2;
  return left >= safeLeft + margin;
}

/**
 * Подобрать кегль так, чтобы строка влезла в безопасную зону.
 * Возвращает готовый размер шрифта и итоговую ширину — по ним и рисуется текст.
 * @param {{measure:(size:number)=>number, size:number, min?:number}} shape
 * @param {number} safeLeft @param {number} [margin]
 */
export function fitFontSize(shape, safeLeft, margin = 24) {
  const limit = 960 - (safeLeft + margin);
  // Центрированная строка: половина доступной ширины на каждую сторону от оси.
  const maxWidth = 2 * limit;
  const measured = shape.measure(shape.size);
  if (measured <= maxWidth || measured <= 0) return { size: shape.size, width: measured };
  const size = Math.max(shape.min ?? 24, shape.size * maxWidth / measured);
  return { size, width: shape.measure(size) };
}
