// Кинематографичные кривые и «блик по золоту» для сцены «Спонсоры».
// Чистые функции без DOM и canvas: их проверяют тесты, а сцена только рисует
// по готовым числам. Все функции детерминированы — от времени кадра, не от
// Date/performance, иначе экспорт разошёлся бы с предпросмотром.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Плавное нарастание 0→1 с медленным выходом (мягче smoothstep по хвосту). */
export function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

/** Разгон-торможение: медленный вход, быстрый центр, мягкая остановка. */
export function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Очень мягкое «дорогое» движение: заметно медленнее в начале и в конце. */
export function easeInOutQuint(t) {
  const x = clamp01(t);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

/** Обратное нарастание — для черчения контуров, которое «дорисовывается». */
export function easeInCubic(t) {
  const x = clamp01(t);
  return x * x * x;
}

/** Пружинное переполнение с затуханием: знак «доезжает» и мягко садится. */
export function easeOutBack(t, overshoot = 1.24) {
  const x = clamp01(t);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c = overshoot - 1;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}

/** Экспоненциальное сглаживание для «инерционных» подхватов. */
export function easeOutExpo(t) {
  const x = clamp01(t);
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * Прогресс по окну [start, start + span]. Отрицательный/нулевой span — сразу 1,
 * чтобы событие без длительности не «залипало» в середине.
 */
export function window01(local, start, span) {
  if (!(span > 0)) return local >= start ? 1 : 0;
  return clamp01((local - start) / span);
}

/**
 * Блик, проходящий по знаку слева направо. Возвращает полосу в долях ширины
 * знака: 0 — блик только входит слева, 1 — уже ушёл справа. Вне окна — null,
 * чтобы вызывающая сторона не тратила кадр на лишний композит.
 */
export function glintSpan(t, { start = 0, span = 1, from = -0.45, to = 1.45 } = {}) {
  const p = window01(t, start, span);
  if (p <= 0 || p >= 1) return null;
  // Мягкий вход/выход полосы внутри окна, чтобы не было «включения» на границе.
  const eased = easeInOutCubic(p);
  return from + (to - from) * eased;
}

/**
 * Проявление с подъёмом и масштабом: значение для одной группы элементов.
 * lift — на сколько px элемент сидит ниже в начале, scaleFrom — с какого
 * размера «доезжает». Возвращает готовые alpha/offset/scale.
 */
export function reveal(local, start, span, { lift = 18, scaleFrom = 0.985, easing = easeOutCubic } = {}) {
  const p = easing(window01(local, start, span));
  return {
    p,
    alpha: p,
    offsetY: (1 - p) * lift,
    scale: scaleFrom + (1 - scaleFrom) * p,
  };
}

/** Общая яркость сцены: мягко поднимается и так же мягко уходит в конце. */
export function scenePresence(local, exitStart, fadeSpan) {
  const inP = easeOutCubic(window01(local, 0, 0.85));
  const outP = easeInOutCubic(window01(local, exitStart, fadeSpan));
  return clamp01(inP * (1 - outP));
}

/**
 * Раскладка пары знаков в ярусе БЕЗ искажения логотипов.
 *
 * Центрировать блоки на фиксированных колонках нельзя: у знаков разные
 * пропорции (3.6:1 у Промрукав, 5.4:1 у КЭАЗ), и пара из блоков разной ширины
 * читается сдвинутой. Сжимать отдельный знак тоже нельзя — это искажает
 * логотип (было сжатие в 1.25 и 1.34 раза).
 *
 * Поэтому пара строится от общих внешних краёв контейнера: одинаковые поля по
 * краям кадра, зазор в центре выводится из ширины. Если оба знака не влезают
 * вместе с зазором, они уменьшаются ОДНИМ коэффициентом — пропорции сохраняются.
 *
 * @param {{center:number, leftWidth:number, rightWidth:number, container:number, gap:number}} spec
 * @returns {{leftX:number, rightX:number, leftWidth:number, rightWidth:number, fit:number, innerGap:number}}
 */
export function pairLayout({ center, leftWidth, rightWidth, container, gap }) {
  const lw = Number.isFinite(leftWidth) && leftWidth > 0 ? leftWidth : 0;
  const rw = Number.isFinite(rightWidth) && rightWidth > 0 ? rightWidth : 0;
  if (!lw && !rw) return { leftX: center, rightX: center, leftWidth: 0, rightWidth: 0, fit: 1, innerGap: 0 };

  const total = lw + rw;
  const usable = Math.max(0, container - Math.max(0, gap));
  const fit = Math.min(1, usable / total);
  const fLeft = lw * fit;
  const fRight = rw * fit;

  const leftEdge = center - container / 2;
  return {
    // Поля по краям равны по построению: обе стороны контейнера отстоят от оси
    // одинаково. Знаки прижаты к своим краям — внешние границы важнее осей.
    leftX: Math.round(leftEdge + fLeft / 2),
    rightX: Math.round(leftEdge + container - fRight / 2),
    leftWidth: fLeft,
    rightWidth: fRight,
    fit,
    innerGap: container - fLeft - fRight,
  };
}

// --- Контур рамки -----------------------------------------------------------
// Углы повторяют ИСХОДНУЮ форму кадра: линии и quadraticCurveTo с управляющей
// точкой в вершине угла. Настоящая дуга радиуса 38 срезает угол заметно
// сильнее (середина дуги отстоит от вершины на .29c, а квадратичная кривая —
// на .5c), поэтому рамка «округлялась». Здесь форма сохранена побитово:
// квадратичные кривые сэмплируются в ломаную, по ней же и рисуется обводка.
const CORNER = 38;
const CORNER_SAMPLES = 12;

function cornerQuad(p0, control, p2, out) {
  for (let i = 1; i <= CORNER_SAMPLES; i++) {
    const t = i / CORNER_SAMPLES, u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * control.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * control.y + t * t * p2.y,
    });
  }
}

const contourCache = new Map();
/** Ломаная по контуру рамки: точки, накопленная длина, периметр. */
export function frameContour(inset = 0) {
  const key = String(inset);
  let cached = contourCache.get(key);
  if (cached) return cached;
  const l = 54 + inset, r = 1866 - inset, t = 42 + inset, b = 1038 - inset, c = CORNER;
  // Обход по часовой стрелке от левого верхнего угла — как в исходном framePath.
  const points = [];
  points.push({ x: l + c, y: t });
  points.push({ x: r - c, y: t });
  cornerQuad({ x: r - c, y: t }, { x: r - c, y: t + c }, { x: r, y: t + c }, points);
  points.push({ x: r, y: b - c });
  cornerQuad({ x: r, y: b - c }, { x: r - c, y: b - c }, { x: r - c, y: b }, points);
  points.push({ x: l + c, y: b });
  cornerQuad({ x: l + c, y: b }, { x: l + c, y: b - c }, { x: l, y: b - c }, points);
  points.push({ x: l, y: t + c });
  cornerQuad({ x: l, y: t + c }, { x: l + c, y: t + c }, { x: l + c, y: t }, points);

  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = cum[cum.length - 1];
  cached = { points, cum, total, inset };
  contourCache.set(key, cached);
  return cached;
}

/** Периметр и длины сторон контура. */
export function framePathMetrics(inset = 0) {
  const { total, points } = frameContour(inset);
  const l = 54 + inset, r = 1866 - inset, t = 42 + inset, b = 1038 - inset;
  return { l, r, t, b, c: CORNER, total, pointCount: points.length };
}

/** Точка на контуре по доле обхода 0…1 и направление касательной в градусах.
 * @param {number} at @param {number} [inset] */
export function framePathPoint(at, inset = 0) {
  const { points, cum, total } = frameContour(inset);
  const wrap = ((Number.isFinite(at) ? at : 0) % 1 + 1) % 1;
  const target = wrap * total;
  // Двоичный поиск по накопленной длине.
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[Math.min(points.length - 1, lo + 1)];
  const span = cum[lo + 1] - cum[lo];
  const u = span > 1e-9 ? (target - cum[lo]) / span : 0;
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
  };
}

/** Участок контура между двумя долями обхода. Если участок переходит через
 * начало, возвращаются два куска — иначе блик обрывался бы на стыке.
 * @param {number} from @param {number} to @param {number} [inset] */
export function framePathSpan(from, to, inset = 0) {
  const span = (Number.isFinite(to) ? to : 0) - (Number.isFinite(from) ? from : 0);
  const parts = [];
  let a = ((Number.isFinite(from) ? from : 0) % 1 + 1) % 1;
  let rest = Math.max(0, Math.min(1, span));
  while (rest > 1e-9) {
    const take = Math.min(rest, 1 - a);
    if (take > 1e-9) parts.push({ from: a, to: a + take });
    rest -= take;
    a = 0;
  }
  return parts;
}

/**
 * Блик по контуру рамки. В отличие от прежнего пятна на верхней кромке, это
 * участок самой линии: он идёт ПО рамке и повторяет её повороты, поэтому на
 * угле нет повёрнутой плашки, торчащей наружу.
 *
 * @param {number} at где сейчас середина блика (доля обхода)
 * @param {{strength?:number, length?:number, inset?:number}} [options]
 *   length — длина блика в пикселях контура
 */
export function frameGlint(at, { strength = 1, length = 240, inset = 0 } = {}) {
  const contour = frameContour(inset);
  const total = contour.total;
  const s = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
  const center = Number.isFinite(at) ? at : 0;
  // Длина блика ЗАВИСИТ от кривизны. На прямом участке отражение вытянуто
  // вдоль линии и тускнеет, на скруглении оно собирается в короткое яркое
  // пятно. Без этого блик на угле выглядел как такой же отрезок, что и на
  // прямой, и читался наклейкой.
  const curvature = curvatureAt(center, inset);
  const straight = Math.min(1, curvature / .22);   // 0 — прямая, 1 — скругление
  const px = length * (.45 + .55 * s) * (1 - .52 * straight);
  const half = px / 2 / total;
  return {
    at: center,
    parts: framePathSpan(center - half, center + half, inset),
    core: s,
    // На скруглении блик ярче — свет собирается на изгибе.
    halo: s * .42 * (1 + .35 * straight),
    curvature: straight,
    // чем короче блик, тем он концентрированнее
    sharpness: .9 + .9 * s + .6 * straight,
  };
}

/** Кривизна контура в точке: 1 минус косинус между хордами до и после.
 * 0 — прямой участок, ~0.3…0.5 — скругление угла.
 * @param {number} at @param {number} [inset] */
export function curvatureAt(at, inset = 0) {
  const contour = frameContour(inset);
  const total = contour.total;
  // Окно ЗАМЕТНО шире самого скругления. Узкое окно внутри дуги даёт почти
  // нулевую кривизну: три точки на дуге радиуса 19 стоят почти на прямой.
  // Кривизна проявляется только когда окно перекрывает переход
  // «дуга → прямая», поэтому здесь ~130 px.
  const w = 65 / total;
  const a = framePathPoint(at - w, inset);
  const b = framePathPoint(at, inset);
  const c = framePathPoint(at + w, inset);
  const ax = b.x - a.x, ay = b.y - a.y;
  const bx = c.x - b.x, by = c.y - b.y;
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
  return 1 - cos;
}

/**
 * Переливание золота на рамке. Ровная позолота читается как нарисованная
 * линия; настоящий профиль меняет тон по длине — от тёмной бронзы к светлому
 * золоту и обратно, — и это переливание медленно смещается.
 *
 * @param {number} tSec абсолютное время сцены
 * @param {number} at доля обхода контура 0…1
 * @param {{motion?:number}} [options]
 * @returns {{tone:number, light:number, sweep:number}}
 */
export function frameGold(tSec, at, { motion = 1 } = {}) {
  const m = Math.max(0, Math.min(1, Number.isFinite(motion) ? motion : 1));
  const time = Number.isFinite(tSec) ? tSec : 0;
  const pos = ((Number.isFinite(at) ? at : 0) % 1 + 1) % 1;
  // Две волны разной длины: одна даёт крупные тёплые пятна, вторая — мелкую
  // рябь металла. Без второй рамка выглядит как гладкая плашка.
  const slow = Math.sin(Math.PI * 2 * (pos * 1.35 - time * .035));
  const fast = Math.sin(Math.PI * 2 * (pos * 3.4 + time * .085 + .31));
  const tone = m * (0.62 * slow + 0.38 * fast);
  return {
    // -1 — тёмная бронза, 0 — базовое золото, +1 — светлое золото
    tone,
    // общая яркость профиля: дышит медленно и почти незаметно
    light: m * (1 + .10 * Math.sin(Math.PI * 2 * (time * .06 + .2))),
    // где сейчас световой удар по длине контура — едет в обратную сторону от блика
    sweep: ((pos * 1.6 - time * .11) % 1 + 1) % 1,
  };
}

/**
 * Ступени света вдоль замкнутого контура. На каждый сегмент нужен ОДИН цвет, и
 * он не должен зависеть от соседних: накопление цвета в 2D-canvas не
 * детерминировано — повторная отрисовка того же кадра с длинными градиентными
 * обводками давала другой пиксель (2009 px расхождения). Флэт-заливки
 * повторяемы, градиенты — нет. Поэтому переливание строится ступенями.
 *
 * @param {number} tSec @param {number} segments @param {{motion?:number}} [options]
 * @returns {{color:[number,number,number], tone:number, light:number}[]}
 */
export function frameGoldSteps(tSec, segments = 96, { motion = 1 } = {}) {
  const steps = [];
  const count = Math.max(1, Math.round(segments));
  for (let i = 0; i < count; i++) {
    const at = i / count;
    const gold = frameGold(tSec, at, { motion });
    steps.push({ at, tone: gold.tone, light: gold.light, color: goldColor(gold.tone, gold.light) });
  }
  return steps;
}

const GOLD_DARK = [167, 121, 66];   // тёмная бронза
const GOLD_BASE = [226, 187, 124];  // базовое золото
const GOLD_LIGHT = [255, 243, 214]; // светлое золото
/** Цвет золота по тону (-1 бронза, +1 светлое золото) и общей яркости. */
export function goldColor(tone, light = 1) {
  const to = tone < 0 ? GOLD_DARK : GOLD_LIGHT;
  const k = Math.min(1, Math.abs(tone));
  return [0, 1, 2].map(i =>
    Math.max(0, Math.min(255, Math.round((GOLD_BASE[i] + (to[i] - GOLD_BASE[i]) * k) * light))));
}

/**
 * Профиль затухания блика вдоль пути. Вынесен отдельно, чтобы им
 * пользовались и графика, и проверки: колокол на концах ноль, в середине
 * единица.
 * @param {number} u 0…1 вдоль блика @param {number} sharpness
 */
export function glintFalloff(u, sharpness = 1.5) {
  const x = Math.min(1, Math.max(0, Number.isFinite(u) ? u : 0));
  return Math.pow(Math.sin(Math.PI * x), sharpness);
}

/**
 * Шаг, которым обходится контур при флэт-отрисовке золота. Ступени должны быть
 * мелкими, иначе видно бандинг, но и не микроскопическими — на кадр приходится
 * ограниченное число обводок.
 * @param {number} totalPx @param {number} [maxSegments]
 */
export function goldSegmentCount(totalPx, maxSegments = 160) {
  const px = Number.isFinite(totalPx) && totalPx > 0 ? totalPx : 0;
  // Шаг ~8 px по контуру: на дуге угла длиной ~60 px это ~8 сегментов,
  // перехода тона внутри одного сегмента не видно.
  return Math.max(24, Math.min(maxSegments, Math.round(px / 8)));
}
