/**
 * Ритм и геометрия заставки спонсора. Чистые функции без three и без картинок:
 * по ним строятся и кадр, и проверки, поэтому раскладка не может разойтись с
 * ожиданиями тестов.
 */
// Пределы знака: ширина важнее высоты, потому что вытянутые логотипы (КЭАЗ
// 5,3:1) должны читаться во всю ширину, а не упираться в высоту блока.
const MARK_MAX_WIDTH = 900;
const MARK_MAX_HEIGHT = 300;
// Знак стоит на оптической середине: чуть выше геометрической, чтобы под ним
// оставалось место для «дыхания» и подписи, а не казалось, что он сполз вниз.
export const MARK_CENTER_Y = 700;

// Идентификаторы в настройках человеческие («Промрукав»), а встроенные знаки
// в программе названы по роли: partner1 — Промрукав, partner2 — КЭАЗ.
export const MARK_KEYS = { promrukav: "partner1", keaz: "partner2" };

/**
 * Когда по знаку проходит блик. Считается от начала знака: он должен вспыхнуть
 * уже севшим, а не во время подъёма. Чистая функция — по ней проверяется ритм.
 * @param {{timeline?:{drawDuration:number,emergeDuration:number}}} cfg
 */
export function markGlintAt(cfg) {
  const tl = cfg?.timeline ?? { drawDuration: 0, emergeDuration: 0 };
  const entry = (tl.drawDuration ?? 0) + (tl.emergeDuration ?? 0);
  return Math.max(1.7, entry * 0.62) + 1.25;
}

/** Множитель размера знака: одна ручка вместо двух пределов в настройках. */
export function markScaleFor(cfg) {
  const value = cfg?.sponsor?.markScale;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0.5, Math.min(1.8, value)) : 1;
}

/**
 * Положение знака в кадре: ширина, высота и масштаб от ОДНОГО коэффициента.
 * Пропорции логотипа нельзя менять ни при каких настройках — это уже было
 * отдельным замечанием по правому верхнему знаку.
 */
export function markBox(logoWidth, logoHeight, scale = 1) {
  const w = Math.max(1, logoWidth), h = Math.max(1, logoHeight);
  const fit = Math.min(MARK_MAX_WIDTH / w, MARK_MAX_HEIGHT / h) * scale;
  return { width: w * fit, height: h * fit, scale: fit };
}

/** Ритм заставки: когда знак садится и когда по нему проходит блик. */
export function sponsorCues(phase, timeline, motion = 1) {
  const local = phase.beforeStart ? 0 : phase.local;
  const entry = timeline.drawDuration + timeline.emergeDuration;
  const exitStart = entry + timeline.holdDuration;
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / Math.max(0.0001, b - a)));
    return t * t * (3 - 2 * t);
  };
  const fade = 1 - smooth(exitStart, exitStart + Math.max(0.05, timeline.fadeDuration) * 0.9, local);
  const visible = (phase.beforeStart ? 0 : smooth(0, 0.85, local)) * fade;
  // Знак входит последним и решительно: окно ~1,2 с, с перелётом. Долгое
  // «выползание» на крупном логотипе читается как задумчивость. Вход начинается
  // уже после того, как встали заголовок и разделитель: кадр строится слоями,
  // а не вспыхивает целиком.
  const markStart = Math.max(1.7, entry * 0.62);
  const markIn = smooth(markStart, markStart + 1.2, local);
  return {
    visible,
    frame: smooth(0.1, Math.max(0.25, timeline.drawDuration), local),
    curtain: smooth(0.05, Math.max(0.3, timeline.drawDuration) * 0.75, local),
    title: smooth(0.12, Math.max(0.4, timeline.drawDuration) * 0.7, local),
    subtitle: smooth(0.35, Math.max(0.5, timeline.drawDuration) * 0.95, local),
    rule: smooth(0.55, Math.max(0.6, timeline.drawDuration) * 1.05, local),
    mark: markIn * fade,
    // Тень под знаком: появляется вместе с ним и держится всё удержание.
    shadow: smooth(markStart * 0.8, markStart + 0.5, local) * fade,
    glint: smooth(markStart + 0.4, markStart + 1.1, local) * fade,
    idle: smooth(entry * 0.6, entry * 0.6 + 1, local) * fade * Math.max(0, Math.min(1, motion)),
    curtainSway: 0,
    local,
    motion,
  };
}

