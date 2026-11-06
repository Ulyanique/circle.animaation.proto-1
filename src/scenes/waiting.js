// Первый ролик — интро. `waiting`/WAITING_DEFAULTS оставлены внутренними
// идентификаторами ради совместимости ссылок, JSON-настроек и экспортёра.
// Здесь нет WebGL и DOM — описание сцены можно читать из тестов и экспортера.
export const WAITING_DEFAULTS = {
  timeline: {
    // длительности фаз в секундах; цикл повторяется бесконечно
    drawDuration: 2.6,     // прорисовка контура
    emergeDuration: 2.4,   // появление из тени (радиальное проявление)
    holdDuration: 6.8,     // собранная заставка читается дольше между входом и уходом
    fadeDuration: 2.3,     // уходит обратно в тень
    restDuration: 1.2,     // пауза в тени перед следующим кругом
    startDelay: 0.6,       // задержка перед первым появлением
    ringsIntro: 4.0,       // неторопливое черчение дуг; свет не опережает построение
    speed: 1.0,            // общая скорость (1 = реальное время)
  },
  logo: {
    scale: 0.47,           // лёгкий акцент на символе без потери пропорций
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
  // Типографика, композиция и декоративные пресеты вынесены в конфиг, чтобы
  // каждая сцена настраивалась и экспортировалась одним JSON.
  caption: {
    fontFamily: "Cormorant Garamond",
    fontWeight: "600",
    customFontName: "",
    customFontDataUrl: "",
    title: "Янтарный циркуль",
    subtitle: "Вечер ретроспектива",
    date: "20 ноября 2026 года",
    phrase: "История продолжается",
    outlineLayers: 1,
    outlineWidth: 0.08,
    outlineOffset: 0.0,
    fillDelay: 0.0,
    penGlow: 1.0,
  },
  layout: {
    logoX: 0,
    logoY: 1.1,
    logoScale: 1,
    logoRotation: 0,
    envL: 1,
    envR: 1,
    bgL: 1,
    bgR: 1,
    topGlowY: 0,
    topGlowScale: 1,
    topGlowOpacity: 1,
    waveY: 0,
    waveScale: 1,
    waveOpacity: 1,
    viewfinderY: 1,
    viewfinderScale: 1,
    viewfinderOpacity: 0.24,
    cornerBrackets: false,
  },
  decor: {
    preset: "none",
    opacity: 0,
    speed: 1,
    color: "#d9b061",
    scale: 1,
    density: 1,
  },
  photoPause: {
    text: "фотопауза • ",
    repeats: 8,
    radius: 1.35,
    fontSize: 42,
    opacity: 0,
    color: "#d9b061",
    turns: 1,
    cornerInset: 0.22,
    cornerLength: 0.42,
    cornerThickness: 0.012,
    cornerOpacity: 0,
  },
  intro: {
    preset: "circle-first",
  },
  finale: {
    finalCircle: "center-construction",
    eraseStart: 0.05,
    logoMoveStart: 0.35,
    depthStart: 0.8,
    depthTravel: 4,
    contourStart: 1.15,
    circleStart: 1.45,
    circleEnd: 2.45,
    circleOpacity: 0.72,
    circleRadius: 0.8,
  },
  animation: {
    inPreset: "contour-to-fill",
    outPreset: "reverse-contour",
    loopPreset: "quiet-breath",
  },
  elements: {},
  playback: {
    paused: false,
  },
};
