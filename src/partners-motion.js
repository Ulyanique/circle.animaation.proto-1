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

/**
 * Геометрия контура рамки в координатах базового кадра 1920×1080.
 * Лежит здесь, а не в partners-graphics.js, чтобы её можно было проверить
 * тестом: блик по контуру считается по той же длине, что и рисуется рамка.
 * @param {number} inset
 */
export function framePathMetrics(inset = 0) {
  const l = 54 + inset, r = 1866 - inset, t = 42 + inset, b = 1038 - inset, c = 38;
  // Длины сегментов по обходу: верх, право, низ, лево. Дуги углов берём как
  // четверть окружности радиуса c — ошибка на скруглении меньше полупикселя.
  const arc = Math.PI * c / 2;
  const top = (r - c) - (l + c);
  const right = (b - c) - (t + c);
  const bottom = (r - c) - (l + c);
  const left = (b - c) - (t + c);
  const total = top + right + bottom + left + 4 * arc;
  return { l, r, t, b, c, arc, top, right, bottom, left, total };
}

/** Точка на контуре рамки по доле обхода 0…1. Обход по часовой стрелке от
 * левого верхнего скругления. Возвращает координаты и направление касательной
 * в градусах: по нему вытягивается блик — на горизонтальных сторонах он
 * горизонтален, на вертикальных вертикален, на дугах повёрнут.
 * @param {number} at @param {number} [inset] */
export function framePathPoint(at, inset = 0) {
  const m = framePathMetrics(inset);
  const { l, r, t, b, c, arc } = m;
  let d = ((Number.isFinite(at) ? at : 0) % 1 + 1) % 1 * m.total;
  const step = (length, from, to, run) => {
    if (d > length) { d -= length; return null; }
    return run(d / Math.max(1e-6, length));
  };

  // Верхняя дуга: от левого скругления к началу верхней прямой.
  let p = step(arc, 0, 1, u => {
    const a = Math.PI + u * Math.PI / 2;
    return { x: l + c + Math.cos(a) * c, y: t + c + Math.sin(a) * c, angle: -u * 90 };
  });
  if (p) return p;
  p = step(m.top, 0, 1, u => ({ x: l + c + m.top * u, y: t, angle: 0 }));
  if (p) return p;
  // Правый верхний угол.
  p = step(arc, 0, 1, u => {
    const a = -Math.PI / 2 + u * Math.PI / 2;
    return { x: r - c + Math.cos(a) * c, y: t + c + Math.sin(a) * c, angle: 90 + u * 90 };
  });
  if (p) return p;
  p = step(m.right, 0, 1, u => ({ x: r, y: t + c + m.right * u, angle: 90 }));
  if (p) return p;
  p = step(arc, 0, 1, u => {
    const a = u * Math.PI / 2;
    return { x: r - c + Math.cos(a) * c, y: b - c + Math.sin(a) * c, angle: 180 + u * 90 };
  });
  if (p) return p;
  p = step(m.bottom, 0, 1, u => ({ x: r - c - m.bottom * u, y: b, angle: 180 }));
  if (p) return p;
  p = step(arc, 0, 1, u => {
    const a = Math.PI / 2 + u * Math.PI / 2;
    return { x: l + c + Math.cos(a) * c, y: b - c + Math.sin(a) * c, angle: 270 + u * 90 };
  });
  if (p) return p;
  p = step(m.left, 0, 1, u => ({ x: l, y: b - c - m.left * u, angle: 270 }));
  if (p) return p;
  // Последняя дуга: замкнутый контур. Здесь арифметика может дать чуть больше
  // остатка из-за округления — возвращаем начало обхода, а не NaN.
  return (() => {
    const u = Math.min(1, d / arc);
    const a = 3 * Math.PI / 2 + u * Math.PI / 2;
    return { x: l + c + Math.cos(a) * c, y: t + c + Math.sin(a) * c, angle: 360 + u * 90 };
  })();
}

/**
 * Блик, бегущий по контуру рамки. В отличие от прежнего размытого пятна на
 * верхней кромке, здесь строится узкая полоса поперёк пути: она самосветится,
 * имеет резкое ядро и мягкий ореол, а на углах поджимается — как отражение на
 * настоящем металлическом профиле.
 *
 * @param {number} at доля обхода контура 0…1
 * @param {{strength?:number, length?:number, width?:number, inset?:number}} [options]
 */
export function frameGlint(at, { strength = 1, length = 210, width = 6, inset = 0 } = {}) {
  const point = framePathPoint(at, inset);
  const s = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
  // Ядро: короткая яркая часть. Ореол: втрое длиннее и мягче.
  return {
    x: point.x, y: point.y, angle: point.angle,
    core: s,
    coreLength: length * (.32 + .68 * s),
    coreWidth: width * (.5 + .5 * s),
    halo: s * .38,
    haloLength: length * 2.6,
    haloWidth: width * 4.2,
  };
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
