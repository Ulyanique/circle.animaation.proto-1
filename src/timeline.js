// Чистая модель фаз цикла; используется и в сцене, и в тестах.
const TAU = Math.PI * 2;
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

/** Момент, когда входная обводка логотипа завершена (локальное время цикла).
 * @param {{drawDuration:number, emergeDuration:number}} tl */
export function logoDrawFinish(tl) { return tl.drawDuration + tl.emergeDuration * 0.12; }

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
  const drawFinish = logoDrawFinish(tl);
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
export function plotSequence(phase, tl, { intro = false, finale = false, directed = false } = {}) {
  if (phase.beforeStart) return { sweep: 0, transfer: 0, opacity: 0, head: 0, trace: 0, reverse: false };
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration;
  const F = tl.fadeDuration, R = tl.restDuration;
  const fadeStart = D + E + H;
  const fadeEnd = fadeStart + F;
  // В интро весь обратный жест помещается в фазу ухода, независимо от паузы.
  if (intro && phase.local >= fadeStart) {
    if (phase.local >= fadeEnd) return { sweep: 0, transfer: 0, opacity: 0, head: 0, trace: 0, reverse: true };
    const p = clamp01((phase.local - fadeStart) / Math.max(F, 1e-4));
    if (finale) {
      if (p < .36) return { sweep: 0, transfer: 0, opacity: 0, head: 0, trace: 0, reverse: true };
      if (p < .50) {
        const retire = 1 - clamp01(phase.draw);
        return { sweep: 1, transfer: 1, opacity: 0, head: .7 * smooth(.36, .40, p),
          trace: 1 - smooth(.27, 1, retire), reverse: true };
      }
      const tail = 1 - smooth(.64, .68, p);
      return { sweep: 1 - smooth(.56, .68, p), transfer: 1 - smooth(.50, .56, p),
        opacity: .65 * smooth(.50, .56, p) * tail, head: .7 * tail, trace: 0, reverse: true };
    }
    if (p < .67) return { sweep: 0, transfer: 0, opacity: 0, head: 0, trace: 0, reverse: true };
    if (p < .80) {
      const retire = 1 - clamp01(phase.draw);
      return { sweep: 1, transfer: 1, opacity: 0, head: .7 * smooth(.67, .72, p),
        trace: 1 - smooth(.27, 1, retire), reverse: true };
    }
    const tail = 1 - smooth(.96, 1, p);
    return { sweep: 1 - smooth(.87, .995, p), transfer: 1 - smooth(.80, .87, p),
      opacity: .65 * smooth(.80, .86, p) * tail, head: .7 * tail, trace: 0, reverse: true };
  }
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
  // В интро точки начинают движение после открытия чёрного шва, чтобы
  // начальные штрихи окружности тоже были видны.
  const start = intro ? Math.min(0.5, D * 0.30) : Math.min(0.32, D * 0.12);
  const end = Math.max(start + 0.1, D * (intro ? 0.68 : 0.60));
  const transferEnd = Math.max(end + 0.05, D * 0.83);
  // Режиссёрский жест имеет нулевое ускорение на границах движения:
  // точка не дёргается при старте, остановке и передаче на контур.
  const move = directed && intro && !finale
    ? (a, b, t) => clamp01(easeInOutCubic((t - a) / Math.max(b - a, 1e-4)))
    : smooth;
  const sweep = move(start, end, phase.local);
  const transfer = move(end, transferEnd, phase.local);
  const opacity = (intro ? smooth(Math.max(0, start - D * 0.12), start, phase.local)
    : smooth(start, start + Math.min(0.35, D * 0.14), phase.local)) *
    (1 - smooth(end, D + E * 0.15, phase.local));
  const head = opacity * (1 - smooth(transferEnd, D * 0.97, phase.local));
  return { sweep, transfer, opacity, head, trace: 0, reverse: false };
}

/** Единственный проход света по металлу — при передаче внимания названию, не на удержании. */
export function heroGlint(phase, tl, captionStart) {
  const settle = tl.drawDuration + tl.emergeDuration;
  // В интро и финале заголовок начинается после кругов и подъёма,
  // а не в начале удержания. Привязываем блик к реальному такту титра.
  const start = captionStart === undefined ? settle - tl.emergeDuration * 0.02 : captionStart - 0.15;
  const end = captionStart === undefined ? settle + Math.min(2.2, tl.holdDuration * 0.45)
    : Math.min(start + 2.2, settle + tl.holdDuration);
  if (phase.beforeStart || end <= start || phase.local >= settle + tl.holdDuration) return { intensity: 0, position: -1 };
  const span = Math.max(end - start, 1e-4);
  const progress = clamp01((phase.local - start) / span);
  const intensity = progress <= 0 || progress >= 1 ? 0 : Math.sin(Math.PI * progress) ** 2;
  const position = smooth(0, 1, progress) * 2 - 1;
  return { intensity, position };
}

/**
 * Медленный проход света по металлу на удержании: знак не должен стоять
 * неподвижно все десять секунд, но акцент удержания — текст, поэтому пик
 * вдвое слабее геройского, а направление обратное. Окно лежит внутри
 * удержания и не пересекает шов: на первой и последней секунде цикла
 * интенсивность нулевая, seek и шов остаются побитово прежними.
 */
export function holdGlint(phase, tl) {
  const settle = tl.drawDuration + tl.emergeDuration;
  const start = settle + tl.holdDuration * 0.30;
  const end = settle + tl.holdDuration * 0.80;
  if (phase.beforeStart || end <= start || phase.local <= start || phase.local >= end) {
    return { intensity: 0, position: 1 };
  }
  const progress = (phase.local - start) / (end - start);
  const intensity = 0.5 * Math.sin(Math.PI * progress) ** 2;
  const position = 1 - 2 * smooth(0, 1, progress);
  return { intensity, position };
}

/** Угловой свет уступает внимание логотипу и тексту, пока дописывается название. */
export function compositionFocus(phase, tl, captionStart) {
  const settle = tl.drawDuration + tl.emergeDuration;
  if (captionStart !== undefined) return smooth(captionStart - 0.4, captionStart + 1.4, phase.local);
  return smooth(settle - tl.emergeDuration * 0.08, settle + 1.4, phase.local);
}

/** Дуги колец начинают движение по очереди и мягко останавливаются замкнутыми. */
export function ringSweep(env, layer) {
  return smooth(0.04 + 0.055 * layer, 0.83 + 0.03 * layer, env);
}

/**
 * Параллакс слоёв: очень медленный сдвиг фона, колец и пыли относительно знака.
 * Считается по круговой фазе цикла, поэтому значение совпадает на первой и
 * последней секунде круга (шов остаётся побитово прежним), а `renderAt(t)`
 * по-прежнему детерминирован.
 * @param {number} t абсолютное время
 * @param {{drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} tl
 * @param {number} amount амплитуда в мировых единицах (1 — примерно 0.01 кадра)
 * @param {number} [period] длина волны в секундах
 */
export function layerParallax(t, tl, amount = 0, period = 26) {
  if (!(amount > 0)) return { x: 0, y: 0 };
  const cycle = tl.drawDuration + tl.emergeDuration + tl.holdDuration + tl.fadeDuration + tl.restDuration;
  if (!(cycle > 0)) return { x: 0, y: 0 };
  // Кратность периоду цикла: на шве смещение возвращается в ту же точку.
  const span = Math.max(1e-3, cycle);
  const whole = Math.max(1, Math.round((period || span) / span));
  const w = TAU * whole / span;
  const k = amount * 0.01;
  return {
    x: k * Math.sin(w * t),
    y: k * 0.55 * Math.sin(2 * w * t + Math.PI / 3),
  };
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
