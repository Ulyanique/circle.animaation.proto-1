// Варианты доставки без кодировщика: чистые данные и функции.
// delivery.js добавляет к этому проверку поддержки WebCodecs, которая тянет
// mediabunny (~527 КБ). Главный бандл и пульт берут метаданные отсюда, а
// кодировщик подгружается динамически — только когда действительно нужен.

import { DELIVERY_CHOICES, DEFAULT_DELIVERY } from "./delivery-catalog.js";

/** @typedef {import("./delivery-catalog.js").DeliveryOption} DeliveryOption */

export { DELIVERY_CHOICES, DEFAULT_DELIVERY };

/** @type {Record<string, DeliveryOption>} */
export const DELIVERY_OPTIONS = Object.freeze(Object.fromEntries(
  DELIVERY_CHOICES.map((option) => [option.id, option])
));

export const DELIVERY_STORAGE_KEY = "circle-anim-delivery-v1";

/** @param {unknown} id */
export function isDeliveryOption(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(DELIVERY_OPTIONS, id);
}

/** @param {string} [id] */
export function deliveryOption(id = DEFAULT_DELIVERY) {
  return DELIVERY_OPTIONS[isDeliveryOption(id) ? id : DEFAULT_DELIVERY];
}

/**
 * Битрейт под вариант доставки: 10 бит при том же визуальном качестве требует
 * меньше данных, поэтому множитель применяется к битрейту кадра.
 * @param {string} id @param {number} bitrate
 */
export function deliveryBitrate(id, bitrate) {
  if (!Number.isFinite(bitrate) || bitrate <= 0) throw new Error("Некорректный битрейт доставки");
  return Math.round(bitrate * deliveryOption(id).bitrateScale);
}

/**
 * Строка кодека для WebCodecs. HEVC 10 бит — Main 10 (profile_idc 2), поэтому
 * автоматическая строка mediabunny (Main, 8 бит) здесь не подходит.
 * @param {DeliveryOption} option
 */
export function codecString(option) {
  if (option.fullCodecString) return option.fullCodecString;
  return option.codec === "hevc" && option.bitDepth === 10 ? "hev1.2.4.L123.B0" : option.codec;
}

/** Понятное человеку имя кодека для отчёта и подписи файла.
 * @param {DeliveryOption} option */
export function deliveryLabel(option) {
  if (option.codec === "avc") return "H.264 8 бит";
  if (option.codec === "hevc") return "HEVC 10 бит";
  if (option.codec === "vp9") return "VP9 10 бит";
  return option.codec;
}

function storage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch (e) { return null; }
}

/** @param {any} [store] */
export function loadDelivery(store = storage()) {
  let saved = null;
  try { saved = store?.getItem(DELIVERY_STORAGE_KEY) ?? null; } catch (e) { saved = null; }
  return isDeliveryOption(saved) ? saved : DEFAULT_DELIVERY;
}

/** @param {string} id @param {any} [store] */
export function saveDelivery(id, store = storage()) {
  if (!isDeliveryOption(id)) return false;
  try { store?.setItem(DELIVERY_STORAGE_KEY, id); } catch (e) { /* приватный режим — не запоминаем */ }
  return true;
}

/** Имя файла записи с учётом варианта доставки.
 * @param {string} base @param {DeliveryOption} option @param {number} width @param {number} height */
export function deliveryFilename(base, option, width, height) {
  const name = `${base}-${width}x${height}`;
  return option.bitDepth === 10 ? `${name}-10bit.${option.extension}` : `${name}.${option.extension}`;
}
