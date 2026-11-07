import { particleCloudDefaults } from "../particle-cloud-config.js";
import { brandDecorDefaults } from "../brand-decor-config.js";
import { backgroundGlowDefaults } from "../background-glow-config.js";
import { customTextDefaults } from "../custom-text.js";

// Стартовое интро: художественные значения по умолчанию.
// Имя файла сохранено для совместимости; это первый ролик, не экран ожидания.
// Здесь нет WebGL и DOM — описание сцены можно читать из тестов и экспортера.
export const WAITING_DEFAULTS = {
  textLayers: customTextDefaults(),
  typography: { font: "cormorant-garamond" },
  caption: {
    titleText: "Янтарный циркуль", subtitleText: "Вечер ретроспектива", dateText: "20 ноября 2026 года",
    titleColor: null, subtitleColor: null, dateColor: null,
    titleVisible: true, subtitleVisible: true, dateVisible: true,
    titleX: 0, titleY: 0, titleScale: 1, subtitleX: 0, subtitleY: 0, subtitleScale: 1,
    dateX: 0, dateY: 0, dateScale: 1,
  },
  ...brandDecorDefaults(),
  ...particleCloudDefaults(),
  ...backgroundGlowDefaults(),
  intro: { cornerDuration: 1.1, liftDuration: 1.4, titleDelay: 0.15 },
  timeline: {
    // длительности фаз в секундах; цикл повторяется бесконечно
    drawDuration: 2.6,     // прорисовка контура
    emergeDuration: 2.4,   // появление из тени (радиальное проявление)
    holdDuration: 10.6,     // собранная заставка читается дольше между входом и уходом
    fadeDuration: 2.3,     // уходит обратно в тень
    restDuration: 1.2,     // пауза в тени перед следующим кругом
    startDelay: 0.15,      // короткая разовая пауза перед стартом интро
    ringsIntro: 4.0,       // неторопливое черчение дуг; свет не опережает построение
    speed: 1.0,            // общая скорость (1 = реальное время)
  },
  logo: {
    visible: true,
    scale: 0.47,           // лёгкий акцент на символе без потери пропорций
    offsetX: 0,            // горизонтальная позиция
    offsetY: 1.1,          // сдвиг логотипа вверх (мировые единицы)
    depth: 0.18,           // толщина экструзии (тоньше, не такой жирный)
    bevel: 0.035,          // скос кромок — ловит блики
    metalness: 1.0,
    roughness: 0.34,       // читаемые грани без белого зеркального пятна
    clearcoat: 0.35,
    envIntensity: 0.75,
    holdScaleFrom: 1.0,    // плавное увеличение во время удержания
    holdScaleTo: 1.04,
    pulseAmount: 0.018,    // амплитуда «дыхания»
    pulseSpeed: 0.55,
    swayAmount: 0.05,      // лёгкое покачивание (рад)
    swaySpeed: 0.35,
    shadowDepth: 0.55,     // насколько глубоко уходит в тень (z-сдвиг)
    revealNoise: 0.22,     // неровность края проявления
    revealGlow: 1.8,       // кромка проявления не выбивает металл в белый
    outlineEnabled: true,
    outlineColor: "#ffd98a",
    outlineOpacity: 0.95,
    outlineWidthPx: 1.6,   // толщина контура в пикселях (1920×1080)
    outlineGlow: 0.35,     // сила свечения контура
    glint: 0.55,           // короткий тёплый блик без потери силуэта
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
    leftVisible: true, rightVisible: true,
    leftOffsetX: 0, leftOffsetY: 0, rightOffsetX: 0, rightOffsetY: 0,
    leftScale: 1, rightScale: 1,
    speed: 0.16,           // медленное движение рисок, не отвлекающее от титра
    tilt: 62,              // наклон колец (градусы)
    thickness: 0.014,      // тонкая линия, как проведённая циркулем
    constructionOpacity: 0.3, // пунктирная окружность-разметка на фоне
    layers: 3,             // количество концентрических колец
    glowIntensity: 2.0,
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
    dust: 360,             // пыль по всей сцене
    rayLift: 1.0,          // насколько пыль подсвечивается световыми лучами
  },
  background: {
    lightSpread: 0.7,     // насколько далеко расходится свет от кругов
    lightIntensity: 0.65,  // яркость отражённого света на фоне
    shimmer: 0.55,         // переливание (шум)
    godRays: 0.35,         // световые лучи от кругов
    fog: 0.7,              // объёмный туман, подсвеченный кругами
    brushed: 0.35,         // тонкая диагональная текстура
    grain: 0.012,          // зерно плёнки (тонкое)
    vignette: 0.85,
    lowerShade: 0.45,      // затемнение нижнего левого угла (как в референсе)
    gridOpacity: 0.02,     // чертёжная сетка на фоне (тонкая)
  },
  constructionGuides: { enabled: true, offsetX: 0, offsetY: 0, scale: 1, opacity: 0.12, color: "#d9b268", timingMode: "scene", timingStart: 25, timingEnd: 90, timingFade: 15 },
  topIllumination: { enabled: true, offsetX: 0, offsetY: 1.5, scale: 1, color: "#ffd98a", lightColor: "#ffe2a6", raysEnabled: true, raysIntensity: 0.8, raysSpeed: 1, raysColor: "#ffd98a" },
  lights: {
    keyIntensity: 8,       // ключевой свет: читаемые грани металла
    topGlow: 10,           // свечение сверху не пересвечивает центр
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
    bloomIntensity: 0.4,
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
