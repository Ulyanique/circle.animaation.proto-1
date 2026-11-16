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
