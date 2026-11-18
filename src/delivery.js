import { canEncodeVideo } from "mediabunny";

// Метаданные и чистые функции живут в delivery-light.js, чтобы главный бандл
// не тянул кодировщик. Здесь остаётся только проверка поддержки WebCodecs.
export {
  DELIVERY_CHOICES, DELIVERY_OPTIONS, DELIVERY_STORAGE_KEY, DEFAULT_DELIVERY,
  isDeliveryOption, deliveryOption, deliveryBitrate, codecString, deliveryLabel,
  loadDelivery, saveDelivery, deliveryFilename,
} from "./delivery-light.js";
import { DELIVERY_OPTIONS, deliveryOption, deliveryBitrate, codecString, deliveryLabel } from "./delivery-light.js";

/** @typedef {import("./delivery-catalog.js").DeliveryOption} DeliveryOption */

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
