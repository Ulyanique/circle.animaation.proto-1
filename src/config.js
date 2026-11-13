import { DECOR_SLOTS } from "./brand-decor-config.js";
import { PARTICLE_CLOUD_IDS } from "./particle-cloud-config.js";
import { BACKGROUND_GLOW_IDS } from "./background-glow-config.js";
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
  { id: "partners", title: "Спонсоры и партнёры (текстовые заглушки)", fields: [
    {key:"title",label:"Название вечера",type:"text",maxLength:120},
    {key:"subtitle",label:"Подзаголовок",type:"text",maxLength:120},
    {key:"organizerLabel",label:"Заголовок организатора",type:"text",maxLength:60},
    {key:"organizer1",label:"Организатор 1",type:"text",maxLength:80},
    {key:"organizer2",label:"Организатор 2",type:"text",maxLength:80},
    {key:"partnerLabel",label:"Заголовок партнёров",type:"text",maxLength:60},
    {key:"partner1",label:"Партнёр 1",type:"text",maxLength:80},
    {key:"partner2",label:"Партнёр 2",type:"text",maxLength:80},
    {key:"frameVisible",label:"Показывать рамку",type:"bool"},
    {key:"curtainVisible",label:"Показывать занавес",type:"bool"},
    {key:"foliageVisible",label:"Показывать золотую ветвь",type:"bool"},
    {key:"compassVisible",label:"Показывать циркуль",type:"bool"},
    {key:"motion",label:"Движение декора при удержании",type:"range",min:0,max:1,step:.01},
  ] },
  { id: "intro", title: "Последовательность интро", fields: [
    { key: "cornerDuration", label: "Прорисовка боковых кругов", type: "range", min: 0.2, max: 4, step: 0.05 },
    { key: "liftDuration", label: "Подъём логотипа", type: "range", min: 0.2, max: 3, step: 0.05 },
    { key: "titleDelay", label: "Пауза до надписей", type: "range", min: 0, max: 3, step: 0.05 },
  ] },
  ...DECOR_SLOTS.map(({section}, index) => ({ id: section, title: `Построительная окружность ${index + 1}`, fields: [
    { key: "present", label: "Добавить окружность в сцену", type: "bool" },
    { key: "enabled", label: "Показать декор", type: "bool" },
    { key: "radius", label: "Радиус", type: "range", min: 0.4, max: 2.5, step: 0.01 },
    { key: "offsetX", label: "Положение по горизонтали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "offsetY", label: "Положение по вертикали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "opacity", label: "Прозрачность линий", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "color", label: "Цвет", type: "color" },
    { key: "speed", label: "Скорость вращения", type: "range", min: -0.3, max: 0.3, step: 0.005 },
    { key: "dustOpacity", label: "Яркость пыли", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "dustSize", label: "Размер пыли", type: "range", min: 0.005, max: 0.06, step: 0.001 },
  ] })),
  ...PARTICLE_CLOUD_IDS.map((id, index) => ({ id, title: `Облако частиц ${index + 1}`, fields: [
    { key: "present", label: "Добавить облако в сцену", type: "bool" },
    { key: "enabled", label: "Показывать облако", type: "bool" },
    { key: "offsetX", label: "Положение по горизонтали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "offsetY", label: "Положение по вертикали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "radius", label: "Радиус облака", type: "range", min: 0.3, max: 3, step: 0.01 },
    { key: "count", label: "Количество частиц", type: "range", min: 0, max: 2000, step: 10 },
    { key: "size", label: "Размер частиц", type: "range", min: 0.005, max: 0.12, step: 0.005 },
    { key: "opacity", label: "Яркость", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "speed", label: "Скорость вращения", type: "range", min: -0.5, max: 0.5, step: 0.01 },
    { key: "color", label: "Цвет", type: "color" },
  ] })),
  ...BACKGROUND_GLOW_IDS.map((id, index) => ({ id, title: `Фоновое свечение ${index + 1}`, fields: [
    { key: "present", label: "Добавить свечение в сцену", type: "bool" },
    { key: "enabled", label: "Показывать свечение", type: "bool" },
    { key: "offsetX", label: "Положение по горизонтали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "offsetY", label: "Положение по вертикали", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "radius", label: "Радиус свечения", type: "range", min: 0.3, max: 5, step: 0.01 },
    { key: "intensity", label: "Яркость", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "pulse", label: "Пульсация", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "speed", label: "Скорость пульсации", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "color", label: "Цвет", type: "color" },
  ] })),
  { id: "finale", title: "Финальный уход", fields: [
    { key: "retreatDepth", label: "Глубина удаления", type: "range", min: 0, max: 5, step: 0.1 },
    { key: "retreatScale", label: "Конечный масштаб", type: "range", min: 0.2, max: 1, step: 0.01 },
    { key: "subtitleDrawDuration", label: "Прорисовка финальной фразы (с)", type: "range", min: 0.2, max: 6, step: 0.05 },
    { key: "subtitleMoveDuration", label: "Переход фразы в центр (с)", type: "range", min: 0.2, max: 6, step: 0.05 },
    { key: "subtitleHoldDuration", label: "Удержание фразы на тёмном фоне (с)", type: "range", min: 0, max: 10, step: 0.05 },
    { key: "subtitleEraseDuration", label: "Стирание финальной фразы (с)", type: "range", min: 0.2, max: 6, step: 0.05 },
  ] },
  { id: "photo", title: "Круговая надпись и рамка", fields: [
    { key: "textEnabled", label: "Надпись по кругу", type: "bool" },
    { key: "text", label: "Текст", type: "text", maxLength: 40 },
    { key: "repeats", label: "Повторений", type: "range", min: 1, max: 8, step: 1 },
    { key: "radius", label: "Радиус надписи", type: "range", min: 1.1, max: 2.15, step: 0.05 },
    { key: "offsetX", label: "Сдвиг надписи по горизонтали", type: "range", min: -2, max: 2, step: 0.01 },
    { key: "offsetY", label: "Сдвиг надписи по вертикали", type: "range", min: -2, max: 2, step: 0.01 },
    { key: "fontSize", label: "Размер букв", type: "range", min: 0.08, max: 0.35, step: 0.01 },
    { key: "rotationSpeed", label: "Скорость вращения", type: "range", min: -0.2, max: 0.2, step: 0.005 },
    { key: "textOpacity", label: "Прозрачность надписи", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "color", label: "Цвет уголков и исходный цвет надписи", type: "color" },
    { key: "textColor", label: "Свой цвет надписи", type: "color", fallback: "#e8c77e" },
    { key: "apertureEnabled", label: "Апертура перед логотипом", type: "bool" },
    { key: "apertureOffsetX", label: "Апертура: сдвиг X", type: "range", min: -2, max: 2, step: 0.01 },
    { key: "apertureOffsetY", label: "Апертура: сдвиг Y", type: "range", min: -2, max: 2, step: 0.01 },
    { key: "apertureRadius", label: "Апертура: радиус", type: "range", min: 0.5, max: 2.5, step: 0.01 },
    { key: "apertureOpacity", label: "Апертура: прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "apertureColor", label: "Апертура: цвет", type: "color" },
    { key: "logoTurns", label: "Оборотов логотипа за 20 с (0 — стоп)", type: "range", min: -3, max: 3, step: 1 },
    { key: "ringRadius", label: "Радиус пунктирного круга", type: "range", min: 0.5, max: 2.5, step: 0.01 },
    { key: "frameEnabled", label: "Уголки кадра", type: "bool" },
    { key: "frameMargin", label: "Отступ уголков", type: "range", min: 0, max: 0.18, step: 0.005 },
    { key: "frameLength", label: "Длина уголков", type: "range", min: 0.02, max: 0.18, step: 0.005 },
    { key: "frameOpacity", label: "Прозрачность уголков", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "framePulse", label: "Амплитуда движения уголков к центру", type: "range", min: 0, max: 0.1, step: 0.005 },
    { key: "framePulseCycles", label: "Пульсаций за цикл", type: "range", min: 1, max: 10, step: 1 },
  ] },
  { id: "caption", title: "Надписи", fields: [
    { key: "titleVisible", label: "Название: показывать", type: "bool" },
    { key: "titleMetallic", label: "Название: металлическое золото", type: "bool" },
    { key: "titleAutoFit", label: "Название: вписать в поля", type: "bool" },
    { key: "titleText", label: "Название: текст", type: "text", maxLength: 120 },
    { key: "titleColor", label: "Название: свой цвет", type: "color", fallback: "#e0b25a" },
    { key: "subtitleVisible", label: "Подзаголовок: показывать", type: "bool" },
    { key: "subtitleAutoFit", label: "Подзаголовок: вписать в поля", type: "bool" },
    { key: "subtitleText", label: "Подзаголовок: текст", type: "text", maxLength: 120 },
    { key: "subtitleColor", label: "Подзаголовок: свой цвет", type: "color", fallback: "#ecd08c" },
    { key: "dateVisible", label: "Дата: показывать", type: "bool" },
    { key: "dateAutoFit", label: "Дата: вписать в поля", type: "bool" },
    { key: "dateText", label: "Дата: текст", type: "text", maxLength: 120 },
    { key: "dateColor", label: "Дата: свой цвет", type: "color", fallback: "#d9b061" },
    { key: "titleX", label: "Название: горизонталь", type: "range", min: -0.45, max: 0.45, step: 0.005 },
    { key: "titleScale", label: "Название: размер", type: "range", min: 0.5, max: 2, step: 0.01 },
    { key: "titleY", label: "Название: вертикаль", type: "range", min: -0.45, max: 0.45, step: 0.005 },
    { key: "subtitleX", label: "Подзаголовок: горизонталь", type: "range", min: -0.45, max: 0.45, step: 0.005 },
    { key: "subtitleScale", label: "Подзаголовок: размер", type: "range", min: 0.5, max: 2, step: 0.01 },
    { key: "subtitleY", label: "Подзаголовок: вертикаль", type: "range", min: -0.45, max: 0.45, step: 0.005 },
    { key: "dateX", label: "Дата: горизонталь", type: "range", min: -0.45, max: 0.45, step: 0.005 },
    { key: "dateScale", label: "Дата: размер", type: "range", min: 0.5, max: 2, step: 0.01 },
    { key: "dateY", label: "Дата: вертикаль", type: "range", min: -0.45, max: 0.45, step: 0.005 },
  ] },
  { id: "typography", title: "Типографика", fields: [
    { key: "font", label: "Шрифт", type: "select", options: FONTS.map(({ id, name }) => ({ value: id, label: name })) },
    { key: "titleTracking", label: "Название: интервал букв (em)", type: "range", min: 0, max: 0.3, step: 0.01 },
    { key: "subtitleTracking", label: "Подзаголовок: интервал букв (em)", type: "range", min: 0, max: 0.6, step: 0.01 },
    { key: "dateTracking", label: "Дата: интервал букв (em)", type: "range", min: 0, max: 0.6, step: 0.01 },
  ] },
  { id: "transition", title: "Переход в эту сцену", fields: [
    { key: "duration", label: "Растворение (с; 0 — склейка)", type: "range", min: 0, max: 5, step: 0.05 },
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
      { key: "visible", label: "Показывать логотип", type: "bool" },
      { key: "cinematic", label: "Кинематографичный свет и металл", type: "bool" },
      { key: "amber", label: "Янтарный срез и подсветка", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "directedMotion", label: "Интро: режиссёрская подача движения", type: "bool" },
      { key: "scale", label: "Размер", type: "range", min: 0.3, max: 2.5, step: 0.01 },
      { key: "offsetX", label: "Положение по горизонтали", type: "range", min: -2, max: 2, step: 0.01 },
      { key: "offsetY", label: "Положение по высоте", type: "range", min: -2, max: 2, step: 0.01 },
      { key: "depth", label: "Толщина", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "bevel", label: "Скос кромок", type: "range", min: 0, max: 0.3, step: 0.005 },
      { key: "metalness", label: "Металличность", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "roughness", label: "Шероховатость", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "clearcoat", label: "Лак", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "facetPolish", label: "Объём граней золота", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "studioRelief", label: "Студийный свет и отражения", type: "range", min: 0, max: 1, step: 0.01 },
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
      { key: "leftVisible", label: "Левый круг и его свет", type: "bool" },
      { key: "leftOffsetX", label: "Левый круг: сдвиг X", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "leftOffsetY", label: "Левый круг: сдвиг Y", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "leftScale", label: "Левый круг: масштаб", type: "range", min: 0.3, max: 2.5, step: 0.01 },
      { key: "rightVisible", label: "Правый круг и его свет", type: "bool" },
      { key: "rightOffsetX", label: "Правый круг: сдвиг X", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "rightOffsetY", label: "Правый круг: сдвиг Y", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "rightScale", label: "Правый круг: масштаб", type: "range", min: 0.3, max: 2.5, step: 0.01 },
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
      { key: "fabricTexture", label: "Текстура тёмного камня", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "lightSpread", label: "Расход света", type: "range", min: 0.2, max: 3, step: 0.01 },
      { key: "lightIntensity", label: "Яркость света на фоне", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "shimmer", label: "Переливание", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "godRaysEnabled", label: "Лучи от кругов: включены", type: "bool" },
      { key: "godRays", label: "Световые лучи", type: "range", min: 0, max: 1.5, step: 0.01 },
      { key: "fogEnabled", label: "Туман: включён", type: "bool" },
      { key: "fog", label: "Объёмный туман", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "brushedEnabled", label: "Диагональная текстура: включена", type: "bool" },
      { key: "brushed", label: "Диагональная текстура", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "grainEnabled", label: "Зерно: включено", type: "bool" },
      { key: "grain", label: "Зерно", type: "range", min: 0, max: 0.2, step: 0.001 },
      { key: "vignetteEnabled", label: "Виньетка фона: включена", type: "bool" },
      { key: "vignette", label: "Виньетка", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "lowerShadeEnabled", label: "Затемнение угла: включено", type: "bool" },
      { key: "lowerShade", label: "Затемнение нижнего левого угла", type: "range", min: 0, max: 1, step: 0.01 },
      { key: "gridEnabled", label: "Сетка фона: включена", type: "bool" },
      { key: "gridOpacity", label: "Чертёжная сетка", type: "range", min: 0, max: 0.3, step: 0.005 },
    ]
  },
  { id: "constructionGuides", title: "Чертёжные линии", fields: [
    { key: "enabled", label: "Включены", type: "bool" },
    { key: "offsetX", label: "Сдвиг X", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "offsetY", label: "Сдвиг Y", type: "range", min: -10, max: 10, step: 0.01 },
    { key: "scale", label: "Размер линий знака", type: "range", min: 0.2, max: 3, step: 0.01 },
    { key: "opacity", label: "Прозрачность", type: "range", min: 0, max: 1, step: 0.01 },
    { key: "color", label: "Цвет", type: "color" },
  ] },
  {
    id: "topIllumination", title: "Верхнее свечение и свет", fields: [
      { key: "enabled", label: "Включены ореол и свет", type: "bool" },
      { key: "offsetX", label: "Позиция X", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "offsetY", label: "Позиция Y", type: "range", min: -10, max: 10, step: 0.01 },
      { key: "scale", label: "Размер ореола", type: "range", min: 0.2, max: 2.5, step: 0.01 },
      { key: "color", label: "Цвет ореола", type: "color" },
      { key: "lightColor", label: "Цвет освещения металла", type: "color" },
      { key: "raysEnabled", label: "Верхние лучи", type: "bool" },
      { key: "raysIntensity", label: "Яркость верхних лучей", type: "range", min: 0, max: 2, step: 0.01 },
      { key: "raysSpeed", label: "Скорость верхних лучей", type: "range", min: 0, max: 3, step: 0.01 },
      { key: "raysColor", label: "Цвет верхних лучей", type: "color" },
    ]
  },
  {
    id: "lights", title: "Свет и тени", fields: [
      { key: "keyIntensity", label: "Ключевой свет", type: "range", min: 0, max: 40, step: 0.1 },
      { key: "topGlow", label: "Сила верхнего свечения и света", type: "range", min: 0, max: 120, step: 0.5 },
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
      { key: "ditherEnabled", label: "Дизеринг: включён", type: "bool" },
      { key: "dither", label: "Дизеринг (против полос)", type: "range", min: 0, max: 2, step: 0.05 },
    ]
  },
];

// Настройки хранятся отдельно для каждой сцены: правка фона не меняет интро.
const STORAGE_PREFIX = "circle-anim-settings-v2";
// Старый единственный ключ читаем один раз, чтобы не потерять настройки интро.
const LEGACY_KEY = "circle-anim-settings-v1";
const PHOTO_CENTER_MIGRATION = "circle-anim-photo-center-v1";
const GUIDES_PLACEMENT_MIGRATION = "circle-anim-guides-placement-v1";
const FINALE_GUIDES_MIGRATION = "circle-anim-finale-guides-v1";
const PHOTO_SIZE_MIGRATION = "circle-anim-photo-size-v1";
const BRAND_CENTER_MIGRATION = "circle-anim-brand-center-v1";
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
export function loadSceneConfig(sceneId, defaults, onReadError) {
  const cfg = cloneDefaults(defaults);
  let raw = null;
  let migratePhotoCenter = false, migratePhotoSize = false, migrateBrandCenter = false, migrateGuides = false, migrateFinaleGuides = false;
  try {
    raw = localStorage.getItem(sceneStorageKey(sceneId));
    if (!raw && sceneId === "waiting") raw = localStorage.getItem(LEGACY_KEY);
    if (sceneId === "photo-pause") {
      migratePhotoCenter = !localStorage.getItem(PHOTO_CENTER_MIGRATION);
      migratePhotoSize = !localStorage.getItem(PHOTO_SIZE_MIGRATION);
    }
    if (sceneId === "finale") migrateFinaleGuides = !localStorage.getItem(FINALE_GUIDES_MIGRATION);
    if (sceneId === "brand") migrateBrandCenter = !localStorage.getItem(BRAND_CENTER_MIGRATION);
    if (sceneId === "waiting" || sceneId === "brand") migrateGuides = !localStorage.getItem(`${GUIDES_PLACEMENT_MIGRATION}:${sceneId}`);
  } catch (e) {
    console.warn("Не удалось прочитать настройки", e);
    onReadError?.(sceneId, e);
    return cfg;
  }
  if (!raw) {
    if (migratePhotoCenter) {
      try { localStorage.setItem(PHOTO_CENTER_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    if (migrateFinaleGuides) {
      try { localStorage.setItem(FINALE_GUIDES_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    if (migrateBrandCenter) {
      try { localStorage.setItem(BRAND_CENTER_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    if (migratePhotoSize) {
      try { localStorage.setItem(PHOTO_SIZE_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    if (migrateGuides) {
      try { localStorage.setItem(`${GUIDES_PLACEMENT_MIGRATION}:${sceneId}`, "1"); } catch (e) { /* noop */ }
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
    // Увеличиваем только прежний стандартный размер; пользовательские размеры не меняем.
    if (migratePhotoSize) {
      if (saved?.logo?.scale === 0.47) {
        saved.logo.scale = defaults.logo.scale;
        try { localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(saved)); } catch (e) { /* noop */ }
      }
      try { localStorage.setItem(PHOTO_SIZE_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    // Старый стандартный шаблон фона переводим в центр однократно; свои
    // положения и отредактированный титр сохраняем. Импорт JSON не меняем.
    if (migrateBrandCenter) {
      if (saved && !saved.photo) {
        if (saved.logo?.offsetY === 0.86) saved.logo.offsetY = defaults.logo.offsetY;
        if (saved.caption?.titleVisible === true && saved.caption?.titleText === 'Янтарный циркуль' &&
            (saved.caption.titleX ?? 0) === 0 && (saved.caption.titleY ?? 0) === 0 &&
            (saved.caption.titleScale ?? 1) === 1 && (saved.caption.titleColor ?? null) === null) saved.caption.titleVisible = false;
        else if (saved.caption && saved.caption.titleVisible === undefined && saved.caption.titleText && saved.caption.titleText !== 'Янтарный циркуль') saved.caption.titleVisible = true;
        try { localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(saved)); } catch (e) { /* noop */ }
      }
      try { localStorage.setItem(BRAND_CENTER_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    // Предыдущее размещение линий переносится однократно; остальные их настройки остаются.
    if (migrateGuides) {
      if (saved?.constructionGuides && saved.constructionGuides.enabled === (sceneId === 'brand')) {
        saved.constructionGuides.enabled = defaults.constructionGuides.enabled;
        try { localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(saved)); } catch (e) { /* noop */ }
      }
      try { localStorage.setItem(`${GUIDES_PLACEMENT_MIGRATION}:${sceneId}`, "1"); } catch (e) { /* noop */ }
    }
    if (migrateFinaleGuides) {
      const g = saved?.constructionGuides;
      // Меняем только нетронутый прежний стандарт. Свою разметку не перезаписываем.
      const prior = {...WAITING_DEFAULTS.constructionGuides, enabled: false};
      if (g && Object.keys(prior).every(key => g[key] === prior[key]) && Object.keys(g).every(key => key in prior)) {
        g.enabled = true;
        try { localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(saved)); } catch (e) { /* noop */ }
      }
      try { localStorage.setItem(FINALE_GUIDES_MIGRATION, "1"); } catch (e) { /* noop */ }
    }
    deepMerge(cfg, saved);
  } catch (e) {
    console.warn("Сохранённые настройки повреждены, взяты умолчания", e);
    onReadError?.(sceneId, e);
  }
  return cfg;
}

export function saveSceneConfig(sceneId, cfg) {
  try {
    localStorage.setItem(sceneStorageKey(sceneId), JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
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
