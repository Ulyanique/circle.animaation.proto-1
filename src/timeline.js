// Чистая модель фаз цикла; используется и в сцене, и в тестах.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Нулевая скорость и ускорение на концах: фазы не дают резкого толчка.
const easeInOutCubic = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };

/**
 * Огибающая угловых огней: из пустоты в начале цикла, обратно в пустоту к паузе.
 * В интро свет раскрывается быстрее, чтобы старт был выразительным, а не тёмным.
 * @param {{local: number}} phase
 * @param {{drawDuration: number, emergeDuration: number, holdDuration: number,
 *   fadeDuration: number, ringsIntro?: number}} tl
 * @param {{fast?: boolean}} [options]
 */
export function ringsEnvelope(phase, tl, { fast = false } = {}) {
  const RI = Math.max(0.05, tl.ringsIntro ?? 2.4);
  const rise = fast ? Math.min(1.35, RI * 0.34) : RI;
  const introE = smooth(0, rise, phase.local);
  const outroStart = tl.drawDuration + tl.emergeDuration + tl.holdDuration;
  const outroE = phase.local < outroStart
    ? 1
    : 1 - smooth(0, Math.max(tl.fadeDuration, 1e-4), phase.local - outroStart);
  return introE * outroE;
}

/**
 * Вычисляет фазу цикла по времени.
 * Цикл: прорисовка контура → появление из тени → удержание → уход в тень → пауза.
 */
export function computePhase(t, tl) {
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration;
  const F = tl.fadeDuration, R = tl.restDuration;
  const cycle = Math.max(0.1, D + E + H + F + R);
  let local = (t - tl.startDelay) % cycle;
  if (local < 0) local += cycle;

  let draw = 0, reveal = 0, outline = 0, fill = 0, emergeT = -1, name = "rest";
  const drawLead = D * 0.75;
  const drawFinish = D + E * 0.12;
  const drawProgress = () => easeInOutCubic(clamp01((local - drawLead) / Math.max(drawFinish - drawLead, 1e-4)));
  if (local < D) {
    name = "draw";
    // Световая точка намечает окружность прежде, чем оживает контур циркуля.
    // Инструмент передаёт свет контуру, а не рисует параллельно.
    draw = drawProgress();
    outline = 1;
  } else if (local < D + E) {
    name = "emerge";
    const p = (local - D) / Math.max(E, 1e-4);
    draw = drawProgress();
    reveal = easeInOutCubic(p);
    outline = 1 - smooth(0.25, 1.0, p);
    fill = easeInOutCubic(p);
  } else if (local < D + E + H) {
    name = "hold";
    draw = 1;
    reveal = 1;
    fill = 1;
  } else if (local < D + E + H + F) {
    name = "fade";
    const p = (local - D - E - H) / Math.max(F, 1e-4);
    // После ухода строк золото уходит в тень, а тонкий контур гаснет последним.
    reveal = 1 - easeInOutCubic(smooth(0.58, 0.94, p));
    fill = reveal; // без скачка заливки на стыке удержания и ухода
    outline = smooth(0.62, 0.76, p) * (1 - smooth(0.86, 1.0, p));
    // Линия отматывается к первой точке чертежа, а не исчезает целиком.
    draw = 1 - smooth(0.78, 1.0, p);
  }
  // прогресс «удержания» для плавного увеличения (0 → 1 от появления до ухода)
  const grow = smooth(0, 1, (local - D) / Math.max(E + H + F, 1e-4));
  const rings = ringsEnvelope({ local }, tl);
  // секунды от начала появления (для искр); -1 — вне интервала
  if (local >= D && local < D + E + H + F) emergeT = local - D;
  return { name, draw, reveal, outline, fill, emergeT, grow, local, cycle, rings,
    beforeStart: t < tl.startDelay };
}

/** Фирменный жест: орбита передаёт свет контуру, а в конце забирает его обратно. */
export function plotSequence(phase, tl) {
  if (phase.beforeStart) return { sweep: 0, transfer: 0, opacity: 0, head: 0, trace: 0, reverse: false };
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration;
  const F = tl.fadeDuration, R = tl.restDuration;
  const fadeStart = D + E + H;
  const fadeEnd = fadeStart + F;
  // Если пауза достаточно длинная, световая точка подхватывает последнюю дугу
  // логотипа, возвращается к орбите и отматывает её к исходной точке.
  if (R >= 0.45 && phase.name === "fade") {
    const p = (phase.local - fadeStart) / Math.max(F, 1e-4);
    if (p >= 0.8) {
      const retire = 1 - clamp01(phase.draw);
      return {
        sweep: 1, transfer: 1, opacity: 0,
        head: 0.7 * smooth(0.80, 0.92, p),
        // Совпадает с headRemain в шейдере обратной прорисовки SVG-контура.
        trace: 1 - smooth(0.27, 1, retire), reverse: true,
      };
    }
  }
  if (R >= 0.45 && phase.name === "rest") {
    const p = clamp01((phase.local - fadeEnd) / Math.min(R, 1.2));
    const tail = 1 - smooth(0.70, 0.90, p);
    return {
      sweep: 1 - smooth(0.24, 0.76, p),
      transfer: 1 - smooth(0, 0.24, p),
      opacity: 0.65 * smooth(0, 0.20, p) * tail,
      head: 0.7 * tail,
      trace: 0, reverse: true,
    };
  }
  const start = Math.min(0.32, D * 0.12);
  const end = Math.max(start + 0.1, D * 0.60);
  const transferEnd = Math.max(end + 0.05, D * 0.83);
  const sweep = smooth(start, end, phase.local);
  const transfer = smooth(end, transferEnd, phase.local);
  const opacity = smooth(start, start + Math.min(0.35, D * 0.14), phase.local) *
    (1 - smooth(end, D + E * 0.15, phase.local));
  const head = opacity * (1 - smooth(transferEnd, D * 0.97, phase.local));
  return { sweep, transfer, opacity, head, trace: 0, reverse: false };
}

/** Единственный проход света по металлу — при передаче внимания названию, не на удержании. */
export function heroGlint(phase, tl) {
  const settle = tl.drawDuration + tl.emergeDuration;
  const start = settle - tl.emergeDuration * 0.02;
  const end = settle + Math.min(1.25, tl.holdDuration * 0.28);
  const span = Math.max(end - start, 1e-4);
  const ramp = Math.min(0.3, span * 0.25);
  const intensity = smooth(start, start + ramp, phase.local) *
    (1 - smooth(end - ramp, end, phase.local));
  const position = clamp01((phase.local - start) / span) * 2 - 1;
  return { intensity, position };
}

/** Угловой свет уступает внимание логотипу и тексту, пока дописывается название. */
export function compositionFocus(phase, tl) {
  const settle = tl.drawDuration + tl.emergeDuration;
  return smooth(settle - tl.emergeDuration * 0.08, settle + 1.4, phase.local);
}

/** Дуги колец начинают движение по очереди и мягко останавливаются замкнутыми. */
export function ringSweep(env, layer) {
  return smooth(0.04 + 0.055 * layer, 0.83 + 0.03 * layer, env);
}

/** Финальный и первый кадры цикла закрыты одним и тем же чёрным кадром. */
export function seamCurtainOpacity(phase, tl) {
  // Стартовая задержка разовая: не показываем в ней хвост предыдущего цикла.
  if (phase.beforeStart) return 1;
  const fadeEnd = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration;
  const rest = Math.max(0, tl.restDuration);
  // В обычной паузе оставляем время для обратной отрисовки орбиты, затем
  // закрываем шов. При короткой или нулевой паузе используем прежнюю заслонку.
  const rewind = rest >= 0.45;
  const span = Math.min(rest, 1.2); // длинная пауза остаётся именно паузой в темноте
  const fadeInStart = rewind ? fadeEnd + span * 0.70 : fadeEnd - Math.min(0.08, tl.fadeDuration * 0.04);
  const fadeInEnd = Math.min(phase.cycle - 0.035, rewind
    ? fadeEnd + span * 0.90
    : fadeEnd + Math.max(0.08, Math.min(0.45, rest * 0.4)));
  const fadeIn = smooth(fadeInStart, Math.max(fadeInStart + 1e-4, fadeInEnd), phase.local);
  const intro = 1 - smooth(0, Math.min(0.5, tl.drawDuration * 0.3), phase.local);
  return Math.max(fadeIn, intro);
}
