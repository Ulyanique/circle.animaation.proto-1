// ─────────────────────────────────────────────────────────────────────────────
// Настройки сцены. ЭТО и есть «по умолчанию».
// Кнопка ⚙ в правом верхнем углу → «Экспорт JSON» выдаёт объект такого же вида.
// Присланный JSON заменяет значения ниже (см. «Импорт» в панели).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULTS = {
  timeline: {
    // длительности фаз в секундах; цикл повторяется бесконечно
    drawDuration: 2.6,     // прорисовка контура
    emergeDuration: 2.4,   // появление из тени (радиальное проявление)
    holdDuration: 4.2,     // висит в центре и пульсирует
    fadeDuration: 2.3,     // уходит обратно в тень
    restDuration: 1.2,     // пауза в тени перед следующим кругом
    startDelay: 0.6,       // задержка перед первым появлением
    ringsIntro: 2.4,       // появление кругов и света из пустого экрана (в начале каждого цикла)
    speed: 1.0,            // общая скорость (1 = реальное время)
  },
  logo: {
    scale: 0.45,           // размер логотипа в кадре (над подписью)
    offsetY: 1.1,          // сдвиг логотипа вверх (мировые единицы)
    depth: 0.18,           // толщина экструзии (тоньше, не такой жирный)
    bevel: 0.035,          // скос кромок — ловит блики
    metalness: 1.0,
    roughness: 0.22,
    clearcoat: 0.6,
    envIntensity: 1.25,
    holdScaleFrom: 1.0,    // плавное увеличение во время удержания
    holdScaleTo: 1.04,
    pulseAmount: 0.018,    // амплитуда «дыхания»
    pulseSpeed: 0.55,
    swayAmount: 0.05,      // лёгкое покачивание (рад)
    swaySpeed: 0.35,
    shadowDepth: 0.55,     // насколько глубоко уходит в тень (z-сдвиг)
    revealNoise: 0.22,     // неровность края проявления
    revealGlow: 2.2,       // яркость «кромки» проявления
    outlineEnabled: true,
    outlineColor: "#ffd98a",
    outlineOpacity: 0.95,
    outlineWidthPx: 1.6,   // толщина контура в пикселях (1920×1080)
    outlineGlow: 0.35,     // сила свечения контура
    glint: 1.0,            // блик, скользящий по золоту во время удержания
  },
  colors: {
    gold: "#c8962e",       // основной металл
    goldHighlight: "#ffe7a6",
    goldDeep: "#6b4a12",
    ringColor: "#e0b25a",
    lightLeft: "#ffb55c",  // свет из верхнего левого круга
    lightRight: "#ffcf7a", // свет из нижнего правого круга
    background: "#030302",
    glowColor: "#ff9d3c",
  },
  rings: {
    enabled: true,
    radius: 1.35,          // радиус основного кольца (в сцене)
    cornerX: 0.44,         // положение (доля ширины)
    cornerY: 0.42,         // положение (доля высоты)
    speed: 0.35,           // скорость вращения
    tilt: 62,              // наклон колец (градусы)
    thickness: 0.014,      // тонкая линия, как проведённая циркулем
    constructionOpacity: 0.3, // пунктирная окружность-разметка на фоне
    layers: 3,             // количество концентрических колец
    glowIntensity: 1.6,
    lightStrength: 3.2,    // сила света, которым кольца освещают сцену
    flicker: 0.12,
  },
  sparks: {
    enabled: true,
    count: 160,            // искры при проявлении логотипа
    speed: 1.0,
    size: 1.0,
    intensity: 1.0,
    life: 1.0,
  },
  particles: {
    enabled: true,
    count: 1400,           // на каждый круг
    size: 1.0,
    speed: 0.5,
    spread: 1.0,           // разброс вокруг колец
    brightness: 1.0,
    dust: 260,             // пыль по всей сцене
    rayLift: 1.0,          // насколько пыль подсвечивается световыми лучами
  },
  background: {
    lightSpread: 0.7,     // насколько далеко расходится свет от кругов
    lightIntensity: 0.55,  // яркость отражённого света на фоне
    shimmer: 0.55,         // переливание (шум)
    godRays: 0.35,         // световые лучи от кругов
    fog: 0.7,              // объёмный туман, подсвеченный кругами
    brushed: 0.35,         // тонкая диагональная текстура
    grain: 0.012,          // зерно плёнки (тонкое)
    vignette: 0.85,
    lowerShade: 0.45,      // затемнение нижнего левого угла (как в референсе)
    gridOpacity: 0.02,     // чертёжная сетка на фоне (тонкая)
  },
  lights: {
    keyIntensity: 14,      // ключевой свет спереди-сверху (тени)
    topGlow: 30,           // свечение сверху за логотипом (тише, центр не пересвечен)
    keyAngle: 35,
    fillIntensity: 0.35,
    shadowSoftness: 6,
    shadowOpacity: 0,      // тень за логотипом выключена
    envEnabled: true,
    exposure: 1.0,         // множитель всех источников света
  },
  post: {
    smaa: true,            // антиалиасинг
    msaaSamples: 4,
    bloomIntensity: 0.55,
    bloomThreshold: 0.85,
    bloomRadius: 0.8,
    dofEnabled: false,     // ДОФ выключен: кадр чёткий, без мыла
    dofBokeh: 0.5,
    dofFocusDistance: 0.0, // сдвиг фокуса от плоскости логотипа
    dofStartBlur: 0,     // размытие в начале фазы появления
    chromaticAberration: 0.0003,   // радиальная: сильнее у краёв кадра
    anamorphic: 0.45,       // анаморфный блик вдоль блика по золоту
  },
  playback: {
    paused: false,
  },
};

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
];

const STORAGE_KEY = "circle-anim-settings-v1";

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

export function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

/** Текущая конфигурация: defaults + сохранённые в localStorage (если есть). */
export function loadConfig() {
  const cfg = cloneDefaults();
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
export function parseConfigJSON(text) {
  const data = JSON.parse(text);
  const cfg = cloneDefaults();
  deepMerge(cfg, data);
  return cfg;
}

export function configToJSON(cfg) {
  return JSON.stringify(cfg, null, 2);
}
