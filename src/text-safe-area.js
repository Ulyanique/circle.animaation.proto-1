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
 *
 * Кромка ткани ДИАГОНАЛЬНАЯ: сверху штора шире (подхват с кистью собирает её к
 * середине), к низу сходится к узкому хвосту. Одна общая граница на весь кадр
 * оказывалась верной только для средних строк: заголовок на y≈160 упирался в
 * ткань, которая там достигает 0.9 ширины, хотя «средняя» доля — 0.78. Поэтому
 * граница хранится профилем по строкам и запрашивается для конкретной строки.
 */
export const CURTAIN_OPAQUE_SHARE = 0.50;
export const CURTAIN_SOLID_SHARE = 0.78;

/**
 * Плотная кромка ткани по строкам кадра: пары [y, x] для исходной ширины 476.
 * Снято с `shtora.png` по альфе > 230/255 с шагом 40 px, хвост складки не в счёт.
 */
export const CURTAIN_EDGE_PROFILE = Object.freeze([
  [0, 474], [40, 460], [80, 445], [120, 429], [160, 413], [200, 397],
  [240, 379], [280, 361], [320, 341], [360, 319], [400, 295], [440, 268],
  [480, 236], [520, 197], [560, 140], [600, 106], [640, 121], [680, 134],
  [720, 147], [760, 159], [800, 170], [840, 182], [880, 193], [920, 204],
  [960, 215], [1000, 226], [1040, 237], [1080, 243],
]);
const PROFILE_WIDTH = 476;

/** Качание шторы в пике: +8 px при полной интенсивности движения (старшая сцена). */
export const CURTAIN_SWAY_PEAK = 9;

/**
 * Плотная кромка ткани на заданной строке кадра, в координатах кадра.
 * Между точками профиля — линейно, за краями — ближайшее значение.
 * @param {number} y строка кадра (0…1080)
 * @param {number} [width] ширина шторы из настроек
 */
export function curtainEdgeAt(y, width = PROFILE_WIDTH) {
  const row = Number.isFinite(y) ? Math.max(0, Math.min(1080, y)) : 0;
  const scale = (Number.isFinite(width) ? width : PROFILE_WIDTH) / PROFILE_WIDTH;
  const profile = CURTAIN_EDGE_PROFILE;
  if (row <= profile[0][0]) return profile[0][1] * scale;
  for (let i = 1; i < profile.length; i++) {
    if (row <= profile[i][0]) {
      const [y0, x0] = profile[i - 1];
      const [y1, x1] = profile[i];
      return (x0 + (x1 - x0) * (row - y0) / (y1 - y0)) * scale;
    }
  }
  return profile[profile.length - 1][1] * scale;
}

/**
 * Правая граница безопасной зоны в координатах кадра.
 * Без `atY` возвращает консервативную общую границу (средние строки кадра);
 * с `atY` — фактическую кромку ткани на этой строке: для заголовка и верхних
 * подписей она заметно дальше, чем «средняя» доля ширины.
 * @param {{curtainVisible?:boolean, curtainWidth?:number}} settings
 * @param {{sway?:number, atY?:number}} [options] смещение ткани от качания в пике
 */
export function textSafeLeft(settings, { sway = CURTAIN_SWAY_PEAK, atY } = {}) {
  if (!settings || settings.curtainVisible === false) return 0;
  const width = Number.isFinite(settings.curtainWidth) ? settings.curtainWidth : 476;
  // Берём плотную часть ткани, а не весь PNG: полупрозрачный хвост складки
  // текст не «съедает», но и подходить к нему вплотную не надо.
  const base = Number.isFinite(atY) ? curtainEdgeAt(atY, width) : width * CURTAIN_SOLID_SHARE;
  return base + Math.abs(sway);
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
