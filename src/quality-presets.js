import { BASE_FRAME } from "./scenes/catalog.js";

/**
 * Пресеты качества постобработки (P2-9). Кадр 4K на software-WebGL стоит
 * дорого: на черновике важна скорость, на мастере — края и отсутствие полос.
 *
 * Пресет меняет только «дорогие» настройки постобработки. Композиция, тайминги
 * и материал от него не зависят, поэтому превью и запись остаются одним кадром.
 */

/** @typedef {{id:string,label:string,description:string,smaa:boolean,msaaSamples:number,bloom:number,dither:number}} QualityPreset */

/** @type {Record<string, QualityPreset>} */
export const QUALITY_PRESETS = Object.freeze({
  draft: Object.freeze({
    id: "draft", label: "Черновик",
    description: "Быстрый кадр для монтажа: MSAA выключен, SMAA мягкий",
    smaa: true, msaaSamples: 0, bloom: 0.7, dither: 1,
  }),
  preview: Object.freeze({
    id: "preview", label: "Превью",
    description: "Обычный просмотр на площадке",
    smaa: true, msaaSamples: 4, bloom: 1, dither: 1,
  }),
  master: Object.freeze({
    id: "master", label: "Мастер",
    description: "Запись: полное сглаживание и полный дизеринг",
    smaa: true, msaaSamples: 4, bloom: 1, dither: 1,
  }),
});

export const DEFAULT_QUALITY = "preview";
export const QUALITY_STORAGE_KEY = "circle-anim-quality-v1";

/**
 * Множители для настроек постобработки сцены.
 * `bloom` и `dither` — коэффициенты к значениям сцены, чтобы пресет не
 * переписывал авторскую яркость блума и амплитуду дизеринга.
 * @param {string} id
 */
export function qualityPostOverrides(id) {
  const preset = QUALITY_PRESETS[id] ?? QUALITY_PRESETS[DEFAULT_QUALITY];
  return {
    id: preset.id,
    smaa: preset.smaa,
    msaaSamples: preset.msaaSamples,
    bloomScale: preset.bloom,
    ditherScale: preset.dither,
  };
}

/**
 * Амплитуда параллакса с учётом разрешения: 2 px при 1080p масштабируются в
 * 4 px на 4K, иначе на большом экране глубина «пропадает».
 * @param {number} amount настройка пользователя
 * @param {{width:number}} master
 */
export function parallaxAmount(amount, master) {
  const base = Number(amount) || 0;
  if (base <= 0) return 0;
  return base * Math.max(1, (master?.width ?? BASE_FRAME.width) / BASE_FRAME.width);
}

/**
 * Применяет пресет к копии постобработки. Не мутирует вход: возвращает новый
 * объект, иначе переключение «Мастер → Превью» теряло бы исходные значения.
 * @param {any} post
 * @param {string} id
 */
export function applyQualityPreset(post, id) {
  const o = qualityPostOverrides(id);
  return {
    ...post,
    smaa: o.smaa,
    msaaSamples: o.msaaSamples,
    bloomIntensity: (post.bloomIntensity ?? 0) * o.bloomScale,
    dither: (post.dither ?? 0) * o.ditherScale,
  };
}

/**
 * Пресет по умолчанию для разрешения: 4K на слабой машине чаще показывают
 * черновиком, но по умолчанию мы не ухудшаем кадр без решения человека.
 * @param {string} masterId
 */
export function suggestedQuality(masterId) {
  return masterId === "2160p" ? "preview" : DEFAULT_QUALITY;
}

/** @param {unknown} id */
export function isQualityPreset(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, id);
}

function defaultStorage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch (e) { return null; }
}

/**
 * Читает сохранённый пресет. Неизвестное или испорченное значение даёт превью:
 * показ не должен падать из-за настройки качества.
 * @param {any} [store]
 */
export function loadQuality(store = defaultStorage()) {
  let saved = null;
  try { saved = store?.getItem(QUALITY_STORAGE_KEY) ?? null; } catch (e) { saved = null; }
  return isQualityPreset(saved) ? saved : DEFAULT_QUALITY;
}

/**
 * @param {string} id
 * @param {any} [store]
 */
export function saveQuality(id, store = defaultStorage()) {
  if (!isQualityPreset(id)) return false;
  try { store?.setItem(QUALITY_STORAGE_KEY, id); } catch (e) { /* приватный режим — не запоминаем */ }
  return true;
}
