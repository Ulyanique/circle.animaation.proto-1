import { FONTS } from "./fonts.js";
import { WAITING_DEFAULTS } from "./scenes/waiting.js";

// ─────────────────────────────────────────────────────────────────────────────
// Настройки активной сцены. ЭТО и есть «по умолчанию».
// Кнопка ⚙ в правом верхнем углу → «Экспорт JSON» выдаёт объект такого же вида.
// Присланный JSON заменяет значения ниже (см. «Импорт» в панели).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULTS = WAITING_DEFAULTS;

// Схема UI: группы → поля. type: range | color | bool
export const SCHEMA = [
  { id: "intro", title: "Последовательность интро", fields: [
    { key: "cornerDuration", label: "Прорисовка боковых кругов", type: "range", min: 0.2, max: 4, step: 0.05 },
    { key: "liftDuration", label: "Подъём логотипа", type: "range", min: 0.2, max: 3, step: 0.05 },
    { key: "titleDelay", label: "Пауза до надписей", type: "range", min: 0, max: 3, step: 0.05 },
  ] },
  { id: "photo", title: "Фотопауза", fields: [
    { key: "textEnabled", label: "Надпись по кругу", type: "bool" },
    { key: "text", label: "Текст", type: "text", maxLength: 40 },
    { key: "repeats", label: "Повторений", type: "range", min: 1, max: 8, step: 1 },
    { key: "radius", label: "Радиус надписи", type: "range", min: 1.1, max: 2.15, step: 0.05 },
    { key: "fontSize", label: "Размер букв", type: "range", min: 0.08, max: 0.35, step: 0.01 },
    { key: "rotationSpeed", label: "Скорость вращения", type: "range", min: -0.2, max: 0.2, step: 0.005 },
    { key: "textOpacity", label: "Прозрачность надписи", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "color", label: "Цвет надписи и уголков", type: "color" },
    { key: "frameEnabled", label: "Уголки кадра", type: "bool" },
    { key: "frameMargin", label: "Отступ уголков", type: "range", min: 0, max: 0.18, step: 0.005 },
    { key: "frameLength", label: "Длина уголков", type: "range", min: 0.02, max: 0.18, step: 0.005 },
    { key: "frameOpacity", label: "Прозрачность уголков", type: "range", min: 0, max: 1, step: 0.01 },
  ] },
  { id: "typography", title: "Типографика", fields: [
    { key: "font", label: "Шрифт", type: "select", options: FONTS.map(({ id, name }) => ({ value: id, label: name })) },
  ] },
  {
    id: "timeline", title: "Таймлайн (сек)", fields: [
      { key: "drawDuration", label: "Прорисовка контура", type: "range", min: 0.5, max: 8, step: 0.05 },
      { key: "emergeDuration", label: "Появление из тени", type: "range", min: 0.5, max: 8, step: 0.05 },
      { key: "holdDuration", label: "Удержание", type: "range", min: 0.5, max: 15, step: 0.05 },
      { key: "fadeDuration", label: "Уход в тень", type: "range", min: 0.5, max: 8, step: 0.05 },
      { key: "restDuration", label: "Пауза в тени", type: "range", min: 0, max: 6, step: 0.05 },
      { key: "startDelay", label: "Задержка старта", type: "range", min: 0, max: 5, step: 0.05 },
      { key: "ringsIntro", label: "Появление кругов", type: "range", min: 0.1, max: 6, step: 0.05 },
      { key: "speed", label: "Скорость", type: "range", min: 0.1, max: 3, step: 0.01 },
    ]
  },
  {
    id: "logo", title: "Логотип", fields: [
      { key: "scale", label: "Размер", type: "range", min: 0.3, max: 2.5, step: 0.01 },
      { key: "offsetY", label: "Положение по высоте", type: "range", min: -2, max: 2, step: 0.01 },
      { key: "depth", label: "Толщина", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "bevel", label: "Скос кромок", type: "range", min: 0, max: 0.3, step: 0.005 },
      { key: "metalness", label: "Металличность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "roughness", label: "Шероховатость", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "clearcoat", label: "Лак", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "envIntensity", label: "Отражения среды", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "holdScaleFrom", label: "Масштаб в начале удержания", type: "range", min: 0.5, max: 1.5, step: 0.001 },
      { key: "holdScaleTo", label: "Масштаб в конце удержания", type: "range", min: 0.5, max: 1.5, step: 0.001 },
      { key: "pulseAmount", label: "Пульсация", type: "range", min: 0, max: 0.1, step: 0.001 },
      { key: "pulseSpeed", label: "Скорость пульсации", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "swayAmount", label: "Покачивание", type: "range", min: 0, max: 0.4, step: 0.005 },
      { key: "swaySpeed", label: "Скорость покачивания", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "shadowDepth", label: "Глубина ухода в тень", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "revealNoise", label: "Неровность проявления", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "revealGlow", label: "Свечение кромки", type: "range", min: 0, max: 6, step: 0.05 },
      { key: "outlineEnabled", label: "Прорисовка контура", type: "bool" },
      { key: "outlineColor", label: "Цвет контура", type: "color" },
      { key: "outlineOpacity", label: "Прозрачность контура", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "outlineWidthPx", label: "Толщина контура (px)", type: "range", min: 0.5, max: 12, step: 0.1 },
      { key: "outlineGlow", label: "Свечение контура", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "glint", label: "Блик по золоту", type: "range", min: 0, max: 3, step: 0.01 },
    ]
  },
  {
    id: "colors", title: "Цвета", fields: [
      { key: "gold", label: "Золото", type: "color" },
      { key: "goldHighlight", label: "Блик золота", type: "color" },
      { key: "goldDeep", label: "Тень золота", type: "color" },
      { key: "ringColor", label: "Кольца", type: "color" },
      { key: "lightLeft", label: "Свет: верх-лев.", type: "color" },
      { key: "lightRight", label: "Свет: низ-прав.", type: "color" },
      { key: "glowColor", label: "Свечение", type: "color" },
      { key: "background", label: "Фон", type: "color" },
    ]
  },
  {
    id: "rings", title: "Кольца в углах", fields: [
      { key: "enabled", label: "Включены", type: "bool" },
      { key: "radius", label: "Радиус", type: "range", min: 0.3, max: 3, step: 0.01 },
      { key: "cornerX", label: "Позиция X", type: "range", min: 0.1, max: 0.7, step: 0.01 },
      { key: "cornerY", label: "Позиция Y", type: "range", min: 0.1, max: 0.7, step: 0.01 },
      { key: "speed", label: "Скорость вращения", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "tilt", label: "Наклон (°)", type: "range", min: 0, max: 90, step: 1 },
      { key: "thickness", label: "Толщина", type: "range", min: 0.005, max: 0.15, step: 0.001 },
      { key: "constructionOpacity", label: "Разметка циркулем", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "layers", label: "Слоёв колец", type: "range", min: 1, max: 6, step: 1 },
      { key: "glowIntensity", label: "Свечение колец", type: "range", min: 0, max: 5, step: 0.05 },
      { key: "lightStrength", label: "Сила света из колец", type: "range", min: 0, max: 10, step: 0.05 },
      { key: "flicker", label: "Мерцание", type: "range", min: 0, max: 1, step: 0.01 },
    ]
  },
  {
    id: "particles", title: "Частицы", fields: [
      { key: "enabled", label: "Включены", type: "bool" },
      { key: "count", label: "Количество (на круг)", type: "range", min: 0, max: 4000, step: 10 },
      { key: "size", label: "Размер", type: "range", min: 0.2, max: 4, step: 0.05 },
      { key: "speed", label: "Скорость", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "spread", label: "Разброс", type: "range", min: 0.2, max: 3, step: 0.01 },
      { key: "brightness", label: "Яркость", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "dust", label: "Пыль на фоне", type: "range", min: 0, max: 1500, step: 10 },
      { key: "rayLift", label: "Пыль в лучах", type: "range", min: 0, max: 3, step: 0.01 },
    ]
  },
  {
    id: "sparks", title: "Искры", fields: [
      { key: "enabled", label: "Включены", type: "bool" },
      { key: "count", label: "Количество", type: "range", min: 0, max: 600, step: 5 },
      { key: "speed", label: "Скорость", type: "range", min: 0.2, max: 3, step: 0.01 },
      { key: "size", label: "Размер", type: "range", min: 0.2, max: 4, step: 0.05 },
      { key: "intensity", label: "Яркость", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "life", label: "Длительность жизни", type: "range", min: 0.2, max: 3, step: 0.01 },
    ]
  },
  {
    id: "background", title: "Фон и свет", fields: [
      { key: "lightSpread", label: "Расход света", type: "range", min: 0.2, max: 3, step: 0.01 },
      { key: "lightIntensity", label: "Яркость света на фоне", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "shimmer", label: "Переливание", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "godRays", label: "Световые лучи", type: "range", min: 0, max: 1.5, step: 0.01 },
      { key: "fog", label: "Объёмный туман", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "brushed", label: "Диагональная текстура", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "grain", label: "Зерно", type: "range", min: 0, max: 0.2, step: 0.001 },
      { key: "vignette", label: "Виньетка", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "lowerShade", label: "Затемнение нижнего левого угла", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "gridOpacity", label: "Чертёжная сетка", type: "range", min: 0, max: 0.3, step: 0.005 },
    ]
  },
  {
    id: "lights", title: "Свет и тени", fields: [
      { key: "keyIntensity", label: "Ключевой свет", type: "range", min: 0, max: 40, step: 0.1 },
      { key: "topGlow", label: "Свечение сверху", type: "range", min: 0, max: 120, step: 0.5 },
      { key: "keyAngle", label: "Угол ключевого света", type: "range", min: 0, max: 80, step: 1 },
      { key: "fillIntensity", label: "Заливка", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "shadowSoftness", label: "Мягкость теней", type: "range", min: 1, max: 20, step: 0.5 },
      { key: "shadowOpacity", label: "Прозрачность теней", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "envEnabled", label: "Окружение (HDR-подобное)", type: "bool" },
      { key: "exposure", label: "Экспозиция света", type: "range", min: 0.2, max: 3, step: 0.01 },
    ]
  },
  {
    id: "post", title: "Постобработка", fields: [
      { key: "smaa", label: "SMAA (сглаживание)", type: "bool" },
      { key: "msaaSamples", label: "MSAA сэмплы", type: "range", min: 0, max: 8, step: 1 },
      { key: "bloomIntensity", label: "Блум", type: "range", min: 0, max: 4, step: 0.01 },
      { key: "bloomThreshold", label: "Порог блума", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "bloomRadius", label: "Радиус блума", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "dofEnabled", label: "Софт-блюр (DOF)", type: "bool" },
      { key: "dofBokeh", label: "Сила боке", type: "range", min: 0, max: 8, step: 0.05 },
      { key: "dofFocusDistance", label: "Фокус (сдвиг)", type: "range", min: -4, max: 4, step: 0.01 },
      { key: "dofStartBlur", label: "Размытие на старте", type: "range", min: 0, max: 8, step: 0.05 },
      { key: "chromaticAberration", label: "Хроматическая аберрация", type: "range", min: 0, max: 0.004, step: 0.0001 },
      { key: "anamorphic", label: "Анаморфный блик", type: "range", min: 0, max: 2, step: 0.01 },
    ]
  },
];

// Настройки хранятся отдельно для каждой сцены: правка фона не меняет интро.
const STORAGE_PREFIX = "circle-anim-settings-v2";
// Старый единственный ключ читаем один раз, чтобы не потерять настройки интро.
const LEGACY_KEY = "circle-anim-settings-v1";
const PHOTO_CENTER_MIGRATION = "circle-anim-photo-center-v1";
export const PROJECT_VERSION = 2;

export function sceneStorageKey(sceneId) {
  return `${STORAGE_PREFIX}:${sceneId}`;
}

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else if (v !== undefined) {
      target[k] = v;
    }
  }
  return target;
}

export function cloneDefaults(defaults = DEFAULTS) {
  return JSON.parse(JSON.stringify(defaults));
}

/** Заменить содержимое объекта, не ломая ссылку, которую держит живая сцена. */
export function replaceConfig(target, source) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    target[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge({}, cloneDefaults(value))
      : value;
  }
  return target;
}

/** Умолчания сцены + присланный фрагмент: недостающие ключи остаются дефолтными. */
export function mergeConfig(defaults, patch) {
  const cfg = cloneDefaults(defaults);
  if (patch && typeof patch === "object") deepMerge(cfg, patch);
  return cfg;
}

/** Настройки сцены: её умолчания + сохранённое в браузере (если есть). */
export function loadSceneConfig(sceneId, defaults) {
  const cfg = cloneDefaults(defaults);
  let raw = null;
  let migratePhotoCenter = false;
  try {
    raw = localStorage.getItem(sceneStorageKey(sceneId));
    if (!raw && sceneId === "waiting") raw = localStorage.getItem(LEGACY_KEY);
    if (sceneId === "photo-pause") migratePhotoCenter = !localStorage.getItem(PHOTO_CENTER_MIGRATION);
  } catch (e) {
    console.warn("Не удалось прочитать настройки", e);
    return cfg;
  }
  if (!raw) {
    if (migratePhotoCenter) {
      try { localStorage.setItem(PHOTO_CENTER_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    return cfg;
  }
  try {
    const saved = JSON.parse(raw);
    // Старое стандартное положение фона было 0.86. Оно ошибочно переносилось
    // в новую центрированную фотопаузу. Иные значения пользовательских правок
    // не трогаем; после первого переноса произвольное положение снова сохраняется.
    if (migratePhotoCenter && saved?.logo?.offsetY === 0.86) {
      saved.logo.offsetY = defaults.logo.offsetY;
      try { localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(saved)); } catch (e) { /* noop */ }
    }
    if (migratePhotoCenter) {
      try { localStorage.setItem(PHOTO_CENTER_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    deepMerge(cfg, saved);
  } catch (e) {
    console.warn("Сохранённые настройки повреждены, взяты умолчания", e);
  }
  return cfg;
}

export function saveSceneConfig(sceneId, cfg) {
  try {
    localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(cfg));
  } catch (e) {
    /* localStorage может быть недоступен */
  }
}

export function resetSceneConfig(sceneId) {
  try {
    localStorage.removeItem(sceneStorageKey(sceneId));
    if (sceneId === "waiting") localStorage.removeItem(LEGACY_KEY);
  } catch (e) { /* noop */ }
}

/** Разбор присланного JSON одной сцены; неизвестные ключи игнорируются. */
export function parseConfigJSON(text, defaults = DEFAULTS) {
  const data = JSON.parse(text);
  // Присланный файл проекта (со «scenes») тоже принимаем, взяв из него свою сцену.
  if (data && data.scenes && typeof data.scenes === "object") {
    throw new Error("Это настройки всего проекта — используйте «Импорт проекта»");
  }
  const cfg = cloneDefaults(defaults);
  deepMerge(cfg, data);
  return cfg;
}

export function configToJSON(cfg) {
  return JSON.stringify(cfg, null, 2);
}

/** Один файл на все четыре сцены: удобно прислать комплект настроек целиком. */
export function projectToJSON(configs, order) {
  const scenes = {};
  for (const id of order) scenes[id] = configs[id];
  return JSON.stringify({ version: PROJECT_VERSION, scenes }, null, 2);
}

/** Читает файл проекта; возвращает только известные сцены. */
export function parseProjectJSON(text, order) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || !data.scenes || typeof data.scenes !== "object") {
    throw new Error("В файле нет объекта scenes");
  }
  const scenes = {};
  for (const id of order) {
    if (data.scenes[id]) scenes[id] = data.scenes[id];
  }
  if (!Object.keys(scenes).length) throw new Error("В файле нет настроек известных сцен");
  return { version: data.version ?? 1, scenes };
}
