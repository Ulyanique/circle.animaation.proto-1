// Чистые расчёты покадрового экспорта: без mediabunny и без DOM.
// Держим их отдельно, чтобы главный бандл не тянул кодировщик (~527 КБ) до
// первого нажатия «Записать»: expoрт подгружается динамически, а оценка
// размера файла и число кадров нужны интерфейсу сразу.

import { BASE_PIXELS } from "./scenes/catalog.js";

/** A frame samples one cycle at an exact output index. Playback speed changes video duration, not sampling accuracy.
 * @param {number} cycle @param {number} speed @param {number} fps */
export function frameCount(cycle, speed, fps) {
  if (!Number.isFinite(cycle) || cycle <= 0 || !Number.isFinite(speed) || speed <= 0 || !Number.isInteger(fps) || fps <= 0)
    throw new Error('Некорректная длительность, скорость или частота кадров');
  return Math.max(1, Math.ceil(cycle * fps / speed - 1e-9));
}

/** @param {number} index @param {number} fps */
export function frameTimestamp(index, fps) { return Math.round(index * 1000000 / fps) / 1000000; }

export const DEFAULT_VIDEO_BITRATE = 40000000;
export const MAX_VIDEO_BITRATE = 120000000;

/** Битрейт растёт вместе с площадью кадра: 4K требует вчетверо больше данных.
 * @param {number} width @param {number} height */
export function videoBitrateFor(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Некорректный размер кадра для оценки битрейта');
  const scaled = DEFAULT_VIDEO_BITRATE * (width * height) / BASE_PIXELS;
  return Math.round(Math.min(MAX_VIDEO_BITRATE, Math.max(DEFAULT_VIDEO_BITRATE, scaled)));
}

/** Rough encoded payload estimate, not peak memory or a guaranteed file size.
 * @param {number} total @param {number} fps @param {number} bitrate */
export function estimateVideoBytes(total, fps, bitrate = DEFAULT_VIDEO_BITRATE) {
  if (!Number.isInteger(total) || total < 1 || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(bitrate) || bitrate <= 0)
    throw new Error('Некорректные параметры оценки видео');
  return total / fps * bitrate / 8;
}

/**
 * Глубина потока по строке кодека, если её видно. `vp09.PP.LL.DD` — поле DD
 * задаёт битность; у H.264 и HEVC глубина в строке не указывается, поэтому
 * получаем `null` и не делаем вид, что знаем больше.
 * @param {string|null} parameterString */
export function codecBitDepth(parameterString) {
  if (typeof parameterString !== 'string') return null;
  const vp9 = /^vp09\.\d{2}\.\d{2}\.(08|10|12)/.exec(parameterString);
  if (vp9) return Number(vp9[1]);
  return null;
}
