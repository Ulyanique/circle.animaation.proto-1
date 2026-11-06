import { WAITING_DEFAULTS } from "./scenes/waiting.js";
import {
  SCENE_IDS, SCENE_LABELS, FONT_CHOICES, INTRO_PRESETS, FINAL_CIRCLES,
  DECOR_PRESETS, ANIMATION_PRESETS, OUT_PRESETS, LOOP_PRESETS,
  createDefaultProject, createSceneDefaults,
} from "./scenes/defaults.js";

export {
  SCENE_IDS, SCENE_LABELS, FONT_CHOICES, INTRO_PRESETS, FINAL_CIRCLES,
  DECOR_PRESETS, ANIMATION_PRESETS, OUT_PRESETS, LOOP_PRESETS,
} from "./scenes/defaults.js";

// ─────────────────────────────────────────────────────────────────────────────
// Настройки активной сцены. ЭТО и есть «по умолчанию».
// Кнопка ⚙ в правом верхнем углу → «Экспорт JSON» выдаёт объект такого же вида.
// Присланный JSON заменяет значения ниже (см. «Импорт» в панели).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULTS = WAITING_DEFAULTS;

// Схема UI: группы → поля. type: range | color | bool
export const SCHEMA = [
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
  {
    id: "caption", title: "Текст и шрифт", fields: [
      { key: "fontFamily", label: "Шрифт", type: "select", options: FONT_CHOICES },
      { key: "fontWeight", label: "Начертание", type: "select", options: [
        { value: "400", label: "400 · обычный" }, { value: "600", label: "600 · полужирный" },
        { value: "700", label: "700 · жирный" },
      ] },
      { key: "customFontDataUrl", label: "Свой шрифт (.ttf/.woff2)", type: "font" },
      { key: "title", label: "Название", type: "text" },
      { key: "subtitle", label: "Подзаголовок", type: "text" },
      { key: "date", label: "Дата", type: "text" },
      { key: "phrase", label: "Фраза финала", type: "text" },
      { key: "outlineLayers", label: "Слоёв контура", type: "range", min: 1, max: 4, step: 1 },
      { key: "outlineWidth", label: "Толщина контура", type: "range", min: 0.01, max: 0.3, step: 0.005 },
      { key: "outlineOffset", label: "Смещение линий", type: "range", min: 0, max: 0.05, step: 0.001 },
      { key: "fillDelay", label: "Задержка заливки", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "penGlow", label: "Свет пера", type: "range", min: 0, max: 2, step: 0.01 },
    ]
  },
  {
    id: "layout", title: "Композиция", fields: [
      { key: "logoX", label: "Лого: X", type: "range", min: -3, max: 3, step: 0.01 },
      { key: "logoY", label: "Лого: Y", type: "range", min: -2, max: 2, step: 0.01 },
      { key: "logoScale", label: "Лого: масштаб", type: "range", min: 0.3, max: 2, step: 0.005 },
      { key: "logoRotation", label: "Лого: поворот", type: "range", min: -0.5, max: 0.5, step: 0.005 },
      { key: "envL", label: "Свет левого круга", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "envR", label: "Свет правого круга", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "bgL", label: "Фон: левый множитель", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "bgR", label: "Фон: правый множитель", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "topGlowY", label: "Верхнее свечение: Y", type: "range", min: -2, max: 3, step: 0.01 },
      { key: "topGlowScale", label: "Верхнее свечение: масштаб", type: "range", min: 0.2, max: 10, step: 0.05 },
      { key: "topGlowOpacity", label: "Верхнее свечение: прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "waveY", label: "Контурные волны: Y", type: "range", min: -2, max: 3, step: 0.01 },
      { key: "waveScale", label: "Контурные волны: масштаб", type: "range", min: 0.2, max: 2, step: 0.01 },
      { key: "waveOpacity", label: "Контурные волны: прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "viewfinderY", label: "Видоискатель: Y", type: "range", min: -2, max: 3, step: 0.01 },
      { key: "viewfinderScale", label: "Видоискатель: масштаб", type: "range", min: 0.5, max: 2, step: 0.01 },
      { key: "viewfinderOpacity", label: "Видоискатель: прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "cornerBrackets", label: "Уголки по краям", type: "bool" },
    ]
  },
  {
    id: "decor", title: "Декор фона", fields: [
      { key: "preset", label: "Пресет", type: "select", options: DECOR_PRESETS },
      { key: "opacity", label: "Прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "speed", label: "Скорость", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "color", label: "Цвет", type: "color" },
    ]
  },
  {
    id: "intro", title: "Интро №1", fields: [
      { key: "preset", label: "Раскадровка", type: "select", options: INTRO_PRESETS },
    ]
  },
  {
    id: "finale", title: "Финал №9", fields: [
      { key: "finalCircle", label: "Финальный круг", type: "select", options: FINAL_CIRCLES },
    ]
  },
  {
    id: "animation", title: "Пресеты анимации", fields: [
      { key: "inPreset", label: "Появление", type: "select", options: ANIMATION_PRESETS },
      { key: "outPreset", label: "Исчезновение", type: "select", options: OUT_PRESETS },
      { key: "loopPreset", label: "Движение на удержании", type: "select", options: LOOP_PRESETS },
    ]
  },
];

const STORAGE_KEY = "circle-anim-settings-v1";
const PROJECT_STORAGE_KEY = "circle-anim-settings-v2";
const PROJECT_VERSION = 2;

export function deepMerge(target, source) {
  for (const k of Object.keys(source || {})) {
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

/** Текущая конфигурация: defaults + сохранённые в localStorage (если есть). */
export function loadConfig(defaults = DEFAULTS) {
  const cfg = cloneDefaults(defaults);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) deepMerge(cfg, JSON.parse(saved));
  } catch (e) {
    console.warn("Не удалось прочитать настройки", e);
  }
  return cfg;
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* localStorage может быть недоступен */
  }
}

export function resetStoredConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
}

/** Разбор присланного JSON; неизвестные ключи игнорируются, значения приводятся к дефолтным типам. */
export function parseConfigJSON(text, defaults = DEFAULTS) {
  const data = JSON.parse(text);
  const cfg = cloneDefaults(defaults);
  deepMerge(cfg, data);
  return cfg;
}

export function configToJSON(cfg) {
  return JSON.stringify(cfg, null, 2);
}

/* ─────────────── Проект v2: настройки всех сцен одним JSON ─────────────── */

/** Мержим присланный проект в существующий объект, сохраняя ссылки на cfg сцен. */
export function mergeProject(target, source) {
  if (!source || typeof source !== "object") return target;
  if (source.scenes || Number(source.version) === PROJECT_VERSION) {
    if (source.activeScene && SCENE_IDS.includes(source.activeScene)) target.activeScene = source.activeScene;
    if (source.editor) deepMerge(target.editor, source.editor);
    for (const id of SCENE_IDS) {
      if (source.scenes?.[id]) deepMerge(target.scenes[id], source.scenes[id]);
    }
  } else {
    // Старый JSON v1 был настройками только первого ролика.
    deepMerge(target.scenes.waiting, source);
  }
  target.version = PROJECT_VERSION;
  return target;
}

function decodeConfigParam(param) {
  // URLSearchParams уже декодирует значение; поддерживаем и «сырой», и base64 JSON.
  try { return JSON.parse(param); } catch (_) { /* пробуем следующий формат */ }
  try { return JSON.parse(decodeURIComponent(param)); } catch (_) { /* пробуем base64 */ }
  const binary = atob(param.replace(/ /g, "+"));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Defaults + localStorage v2 (или миграция v1) + ?config=<URL-encoded JSON|base64>. */
export function loadProject() {
  const project = createDefaultProject();
  try {
    const savedV2 = typeof localStorage !== "undefined" && localStorage.getItem(PROJECT_STORAGE_KEY);
    if (savedV2) mergeProject(project, JSON.parse(savedV2));
    else {
      const savedV1 = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
      if (savedV1) deepMerge(project.scenes.waiting, JSON.parse(savedV1));
    }
  } catch (e) {
    console.warn("Не удалось прочитать настройки", e);
  }
  if (typeof location !== "undefined") {
    const param = new URLSearchParams(location.search).get("config");
    if (param) {
      try { mergeProject(project, decodeConfigParam(param)); }
      catch (e) { console.warn("Не удалось применить ?config", e); }
    }
  }
  return project;
}

export function saveProject(project) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch (e) {
    console.warn("Не удалось сохранить настройки", e);
  }
}

export function resetStoredProject() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) { /* noop */ }
}

export function parseProjectJSON(text, project = createDefaultProject()) {
  mergeProject(project, JSON.parse(text));
  return project;
}

export function projectToJSON(project) {
  return JSON.stringify(project, null, 2);
}

export function projectToURL(project, base = typeof location !== "undefined" ? location.href : "http://localhost/") {
  const url = new URL(base);
  url.searchParams.set("config", JSON.stringify(project));
  return url.toString();
}

/** Сброс одной сцены на месте, чтобы не рвать ссылку scene.cfg. */
export function resetProjectScene(project, id) {
  if (!SCENE_IDS.includes(id)) return project.scenes[id];
  const current = project.scenes[id];
  for (const key of Object.keys(current)) delete current[key];
  Object.assign(current, createSceneDefaults(id));
  return current;
}
