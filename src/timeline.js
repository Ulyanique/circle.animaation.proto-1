// Чистая модель фаз цикла; используется и в сцене, и в тестах.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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
    outline = smooth(0.62, 0.76, p) * (1 - smooth(0.86, 1.0, p));
    // Линия отматывается к первой точке чертежа, а не исчезает целиком.
    draw = 1 - smooth(0.78, 1.0, p);
  }
  // прогресс «удержания» для плавного увеличения (0 → 1 от появления до ухода)
  const grow = clamp01((local - D) / Math.max(E + H + F, 1e-4));
  // огибающая кругов/света: из пустоты в начале цикла, обратно в пустоту к паузе
  const RI = Math.max(0.05, tl.ringsIntro ?? 2.4);
  const introE = smooth(0, RI, local);
  const outroStart = D + E + H;
  const outroE = local < outroStart ? 1 : 1 - smooth(0, Math.max(F, 1e-4), local - outroStart);
  const rings = introE * outroE;
  // секунды от начала появления (для искр); -1 — вне интервала
  if (local >= D && local < D + E + H + F) emergeT = local - D;
  return { name, draw, reveal, outline, fill, emergeT, grow, local, cycle, rings };
}

/** Фирменный жест: точка обводит орбиту и передаёт движение контуру логотипа. */
export function plotSequence(phase, tl) {
  const D = tl.drawDuration, E = tl.emergeDuration;
  const start = Math.min(0.32, D * 0.12);
  const end = Math.max(start + 0.1, D * 0.60);
  const transferEnd = Math.max(end + 0.05, D * 0.83);
  const sweep = smooth(start, end, phase.local);
  const transfer = smooth(end, transferEnd, phase.local);
  const opacity = smooth(start, start + Math.min(0.35, D * 0.14), phase.local) *
    (1 - smooth(end, D + E * 0.15, phase.local));
  const head = opacity * (1 - smooth(transferEnd, D * 0.97, phase.local));
  return { sweep, transfer, opacity, head };
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
  const fadeEnd = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration;
  const fadeInStart = fadeEnd - Math.min(0.08, tl.fadeDuration * 0.04);
  // При restDuration=0 закрываем последний контур до самого шва.
  const fadeInEnd = Math.min(phase.cycle - 0.035,
    fadeEnd + Math.max(0.08, Math.min(0.45, tl.restDuration * 0.4)));
  const fadeIn = smooth(fadeInStart, Math.max(fadeInStart + 1e-4, fadeInEnd), phase.local);
  const intro = 1 - smooth(0, Math.min(0.5, tl.drawDuration * 0.3), phase.local);
  return Math.max(fadeIn, intro);
}
