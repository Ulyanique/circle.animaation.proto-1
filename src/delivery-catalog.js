// Лёгкие подписи вариантов доставки: id, название, описание.
// Отдельно от delivery.js, потому что тот тянет mediabunny ради проверки
// поддержки кодировщика. Пульту достаточно подписей, чтобы нарисовать
// селектор; кодировщик подгружается динамически при первой проверке.

/** @typedef {{id:string, label:string, description:string, container:"mp4"|"webm",
 *   codec:"avc"|"hevc"|"vp9", fullCodecString:string|null, bitDepth:8|10,
 *   bitrateScale:number, extension:string}} DeliveryOption */

/** Метаданные без кодировщика: используются и в delivery.js, и в пульте. */
export const DELIVERY_CHOICES = Object.freeze([
  Object.freeze({
    id: "h264", label: "H.264 · MP4 (совместимость)",
    description: "Играет везде: плееры площадки, ноутбук, старый проектор. 8 бит.",
    container: "mp4", codec: "avc", fullCodecString: null, bitDepth: 8,
    bitrateScale: 1, extension: "mp4",
  }),
  Object.freeze({
    id: "hevc10", label: "HEVC 10 бит · MP4",
    description: "Меньше полос на тёмном градиенте при том же размере файла. Требует поддержки HEVC в браузере.",
    container: "mp4", codec: "hevc", fullCodecString: null, bitDepth: 10,
    bitrateScale: 0.7, extension: "mp4",
  }),
  Object.freeze({
    id: "vp9_10", label: "VP9 10 бит · WebM (резерв)",
    description: "Честные 10 бит там, где HEVC в браузере нет. MP4-плееры площадки WebM обычно не читают.",
    container: "webm", codec: "vp9", fullCodecString: "vp09.02.10.10", bitDepth: 10,
    bitrateScale: 0.7, extension: "webm",
  }),
]);

export const DEFAULT_DELIVERY = "h264";
