import { WAITING_DEFAULTS } from "./waiting.js";
import { FIELD_TIMING } from "./cues.js";

export const SCENE_IDS = Object.freeze(["waiting", "brand", "photo-pause", "finale"]);
export const SCENE_LABELS = Object.freeze({
  waiting: "01 · Интро",
  brand: "02 · Фирменный фон",
  "photo-pause": "08 · Фотопауза",
  finale: "09 · Финал",
});

export const FONT_CHOICES = Object.freeze([
  { value: "Cormorant Garamond", label: "Cormorant Garamond" },
  { value: "PT Serif", label: "PT Serif" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Montserrat", label: "Montserrat" },
]);
export const INTRO_PRESETS = Object.freeze([
  { value: "three-acts", label: "Три такта одной линии" },
  { value: "circle-first", label: "Круг → лого → круги → титр" },
]);
export const FINAL_CIRCLES = Object.freeze([
  { value: "center-construction", label: "Окружность в центре из начала №1" },
  { value: "last-arc", label: "Последняя дуга контура из конца №1" },
  { value: "corner-rings", label: "Угловые кольца" },
]);
export const DECOR_PRESETS = Object.freeze([
  { value: "none", label: "Выключен" },
  { value: "blueprint-arcs", label: "Чертёжные дуги и блики" },
  { value: "sun-rays", label: "Лучи и боке" },
  { value: "gold-dust", label: "Золотая пыль" },
]);
export const ANIMATION_PRESETS = Object.freeze([
  { value: "contour-to-fill", label: "Контур → заливка" },
  { value: "fade", label: "Проявление" },
  { value: "scale-in", label: "Масштаб" },
  { value: "draw-on", label: "Прорисовка" },
]);
export const OUT_PRESETS = Object.freeze([
  { value: "reverse-contour", label: "Обратный контур" },
  { value: "fade", label: "Затухание" },
  { value: "scale-out", label: "Уменьшение" },
]);
export const LOOP_PRESETS = Object.freeze([
  { value: "quiet-breath", label: "Тихое дыхание" },
  { value: "none", label: "Без движения" },
  { value: "slow-drift", label: "Медленный дрейф" },
]);

/** @param {unknown} value */
const clone = (value) => JSON.parse(JSON.stringify(value));
/** @param {Record<string, any>} target @param {Record<string, any> | undefined} source */
function merge(target, source) {
  const src = source || {};
  for (const key of Object.keys(src)) {
    const value = src[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      merge(target[key], value);
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}

/** @param {number} cycle @param {number} [speed] */
function fieldTimeline(cycle, speed = 1) {
  return {
    drawDuration: 0,
    emergeDuration: 0,
    holdDuration: cycle,
    fadeDuration: 0,
    restDuration: 0,
    startDelay: 0,
    ringsIntro: 0,
    speed,
  };
}

const FIELD_VISUALS = {
  timeline: fieldTimeline(24),
  caption: {
    title: "Янтарный циркуль",
    subtitle: "Вечер ретроспектива",
    date: "20 ноября 2026 года",
  },
  rings: {
    layers: 2,
    glowIntensity: 0.85,
    lightStrength: 1.3,
    constructionOpacity: 0.18,
    flicker: 0,
  },
  particles: { count: 380, dust: 170, brightness: 0.65 },
  sparks: { count: 70, intensity: 0.48 },
  background: {
    lightIntensity: 0.55,
    fog: 0.46,
    godRays: 0.25,
    gridOpacity: 0.012,
    shimmer: 0.38,
  },
  lights: { topGlow: 7 },
  layout: {
    logoY: 0.55,
    logoScale: 1.085,
    logoRotation: 0.075,
    envL: 0.48,
    envR: 0.43,
    topGlowY: 1.05,
    topGlowScale: 5.5,
    topGlowOpacity: 0.8,
    waveY: 1.00,
  },
  decor: { preset: "none", opacity: 0 },
};

const PHOTO_VISUALS = {
  timeline: fieldTimeline(24),
  caption: {
    title: "Фотопауза",
    subtitle: "Вечер ретроспектива",
    date: "20 ноября 2026 года",
  },
  layout: {
    logoY: 1.00,
    bgL: 0.83,
    bgR: 0.91,
    waveOpacity: 0.72,
    topGlowY: 1.00,
    // baseline: BrandScene 0.8 × PhotoPause 0.88
    topGlowOpacity: 0.704,
    viewfinderY: 1.00,
    viewfinderOpacity: 0.24,
  },
};

const FINALE_VISUALS = {
  timeline: fieldTimeline(18),
  caption: {
    title: "Янтарный циркуль",
    subtitle: "История продолжается",
    date: "20 ноября 2026 года",
    phrase: "История продолжается",
  },
  layout: {
    logoY: 1.00,
    bgL: 0.94,
    bgR: 0.93,
    waveScale: 0.72,
    waveOpacity: 0.68,
    // baseline: BrandScene 0.8, Finale добавляет только cue.light
    topGlowOpacity: 0.8,
  },
  finale: { finalCircle: "center-construction" },
};

/** Полный набор настроек одной сцены. Значения по умолчанию повторяют текущий вид.
 * @param {string} id
 */
export function createSceneDefaults(id) {
  const base = clone(WAITING_DEFAULTS);
  if (id === "waiting") return base;
  if (id === "brand") return merge(base, FIELD_VISUALS);
  if (id === "photo-pause") return merge(base, merge(clone(FIELD_VISUALS), PHOTO_VISUALS));
  if (id === "finale") return merge(base, merge(clone(FIELD_VISUALS), FINALE_VISUALS));
  throw new Error(`Неизвестная сцена: ${id}`);
}

export function createDefaultProject() {
  /** @type {Record<string, ReturnType<typeof createSceneDefaults>>} */
  const scenes = {};
  for (const id of SCENE_IDS) scenes[id] = createSceneDefaults(id);
  return { version: 2, activeScene: "waiting", scenes, editor: { enabled: false, snap: 0.01, grid: false } };
}

/** Внутренний таймлайн полевых сцен: фазы фиксированы, удержание тянется от внешнего цикла.
 * @param {number} cycle @param {number} [speed]
 */
export function sceneRenderTimeline(cycle, speed = 1) {
  const hold = Math.max(0.2, cycle - FIELD_TIMING.drawDuration - FIELD_TIMING.emergeDuration -
    FIELD_TIMING.fadeDuration - FIELD_TIMING.restDuration);
  return {
    ...FIELD_TIMING,
    startDelay: 0,
    holdDuration: hold,
    ringsIntro: FIELD_TIMING.ringsIntro,
    speed,
  };
}
