import { canEncodeVideo } from "mediabunny";

/**
 * Доставка мастера (P0-2).
 *
 * Файл для площадки и файл для монтажа — разные вещи. Площадка просит
 * совместимый H.264 в MP4; монтаж часто просит 10 бит, иначе на тёмном
 * градиенте видны ступени. Здесь только описание вариантов и честная проверка
 * возможностей браузера: молчаливой деградации нет, недоступный вариант
 * сообщает причину.
 */

/**
 * @typedef {Object} DeliveryOption
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {"mp4"|"webm"} container
 * @property {"avc"|"hevc"|"vp9"} codec кодовое имя mediabunny
 * @property {string|null} fullCodecString строка для WebCodecs; null — собрать автоматически
 * @property {8|10} bitDepth
 * @property {number} bitrateScale множитель к базовому битрейту кадра
 * @property {string} extension
 */

/** @type {Record<string, DeliveryOption>} */
export const DELIVERY_OPTIONS = Object.freeze({
  h264: Object.freeze({
    id: "h264", label: "H.264 · MP4 (совместимость)",
    description: "Играет везде: плееры площадки, ноутбук, старый проектор. 8 бит.",
    container: "mp4", codec: "avc", fullCodecString: null, bitDepth: 8,
    bitrateScale: 1, extension: "mp4",
  }),
  hevc10: Object.freeze({
    id: "hevc10", label: "HEVC 10 бит · MP4",
    description: "Меньше полос на тёмном градиенте при том же размере файла. Требует поддержки HEVC в браузере.",
    container: "mp4", codec: "hevc", fullCodecString: null, bitDepth: 10,
    bitrateScale: 0.7, extension: "mp4",
  }),
  vp9_10: Object.freeze({
    id: "vp9_10", label: "VP9 10 бит · WebM (резерв)",
    description: "Честные 10 бит там, где HEVC в браузере нет. MP4-плееры площадки WebM обычно не читают.",
    container: "webm", codec: "vp9", fullCodecString: "vp09.02.10.10", bitDepth: 10,
    bitrateScale: 0.7, extension: "webm",
  }),
});

export const DEFAULT_DELIVERY = "h264";
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

/**
 * Проверяет, умеет ли этот браузер нужный кодек в нужном разрешении.
 * Возвращает причину отказа, а не просто false: пользователь должен понимать,
 * почему вариант недоступен.
 * @param {string} id @param {{width:number,height:number,bitrate:number,fps:number}} frame
 * @returns {Promise<{ok:boolean, option:DeliveryOption, reason:string|null}>}
 */
export async function probeDelivery(id, frame) {
  const option = deliveryOption(id);
  if (typeof VideoEncoder === "undefined") {
    return { ok: false, option, reason: "Браузер не поддерживает WebCodecs" };
  }
  const config = { width: frame.width, height: frame.height, bitrate: frame.bitrate, frameRate: frame.fps };
  const full = codecString(option);
  try {
    // canEncodeVideo сам собирает строку кодека; для 10 бит передаём точную.
    const ok = full === option.codec
      ? await canEncodeVideo(option.codec, config)
      : await canEncodeVideo(option.codec, { ...config, fullCodecString: full });
    if (ok) return { ok, option, reason: null };
  } catch (error) {
    return { ok: false, option, reason: error instanceof Error ? error.message : String(error) };
  }
  return { ok: false, option, reason: `${deliveryLabel(option)} не поддерживается в ${frame.width}×${frame.height}. Попробуйте другой вариант или разрешение.` };
}

/** @param {{width:number,height:number,bitrate:number,fps:number}} frame
 * @returns {Promise<Record<string, {ok:boolean, reason:string|null}>>} */
export async function probeAllDeliveries(frame) {
  const entries = await Promise.all(Object.keys(DELIVERY_OPTIONS).map(async id => {
    const result = await probeDelivery(id, frame);
    return [id, { ok: result.ok, reason: result.reason }];
  }));
  return Object.fromEntries(entries);
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
