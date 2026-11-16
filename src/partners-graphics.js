import { BASE_FRAME } from "./scenes/catalog.js";
import {
  frameGlint, framePathSpan, frameContour, frameGoldSteps, goldSegmentCount, glintFalloff,
} from "./partners-motion.js";
// Нарисованные в canvas элементы: никакой декоративной части в фоновой
// текстуре нет. Все огибающие зависят только от абсолютного времени сцены.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a,b,x) => { const t=clamp((x-a)/Math.max(.0001,b-a)); return t*t*(3-2*t); };

export function partnersCues(phase, timeline, motion = 1) {
  const local = phase.beforeStart ? 0 : phase.local;
  const exitStart = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration;
  const fade = 1 - smooth(exitStart, exitStart + Math.max(.05,timeline.fadeDuration)*.9,local);
  const visible = (phase.beforeStart ? 0 : smooth(0,.85,local)) * fade;
  const startSpan = Math.max(.25,timeline.drawDuration);
  const entry = (a,b) => smooth(a*startSpan,b*startSpan,local);
  const m = clamp(Number.isFinite(motion) ? motion : 1);
  const idle = smooth(startSpan,startSpan+1,local)*fade*m;
  return {
    visible, frame:entry(.08,.9), curtain:entry(.02,.65), foliage:entry(.18,1.0),
    compass:entry(.28,1.1), title:entry(.10,.65),
    organizerLabel:entry(.35,.9),
    // Знаки приходят решительно: окно входа ~1 с вместо прежних 2,3 с. Долгое
    // «выползание» читалось как вялость, а блик включался до того, как знак
    // успевал появиться. Теперь сначала знак садится, потом по нему идёт блик.
    organizer:entry(.65,1.03), organizerSecond:entry(.85,1.23),
    partnerLabel:entry(1.12,1.45), partner:entry(1.3,1.68), partnerSecond:entry(1.5,1.88),
    separator:entry(.9,1.25),
    // Тонкая линия под заголовком чертится ОТДЕЛЬНО от текста и позже него:
    // раньше она росла вместе с заголовком, и не было ощущения, что кадр
    // строится слой за слоем.
    rule:entry(.52,.98),
    light: smooth(.45,1.2,local)*(1-smooth(3.8,5.2,local))*m,
    glint: (.5 + .5*Math.sin(local*.39-1.2))*idle,
    // Яркость блика по знакам: заметен, но не «мигает» — гаснет к уходу сцены.
    glintStrength: .85*m*fade,
    // Тень под знаками появляется вместе с ними и держится ровно: она даёт
    // глубину, но не должна «дышать» вместе с частицами.
    shadow: smooth(.5,1.6,local)*(1-smooth(exitStart+.2,exitStart+1.0,local)),
    // Дыхание удержания: 10 секунд статичных знаков читаются как «картинка», а
    // не как анимация. Амплитуда намеренно мала (2 px), чтобы не было качки.
    idle: idle,
    // Второй, медленный проход блика на удержании: дорогой акцент, не мигание.
    holdGlint: smooth(2.2,3.4,local)*fade, 
    leafMotion: idle*Math.sin(local*.48+.7),
    curtainSway: idle * Math.sin(local*.42)*8,
    foliageSway: idle * Math.sin(local*.35+1)*.012,
    compassSway: idle * Math.sin(local*.30+.4)*.008,
    motion:m,
    // Абсолютное время сцены: по нему живут золото рамки и бегущий блик.
    // Раньше графика брала только амплитуды, поэтому переливание построить
    // было не из чего.
    local,
  };
}

// Контур рамки строится по точкам frameContour(): исходные линии плюс
// квадратичные скругления. Раньше здесь были настоящие дуги — рамка стала
// округлой, а форма кадра изменилась. Теперь она возвращена к прежней.
function contourPoints(ctx, contour) {
  const { points } = contour;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}
function framePath(ctx, inset) { contourPoints(ctx, frameContour(inset)); }

/** Обводка участка контура между двумя долями обхода. Куски за границами
 * зажимаются: этим рисуются и ступени золота, и сегменты блика. */
function contourPointsFor(ctx, from, to) {
  const contour = frameContour(0);
  const { points, cum, total } = contour;
  const lo = Math.max(0, Math.min(1, from)) * total;
  const hi = Math.max(0, Math.min(1, to)) * total;
  if (hi - lo < .01) return;
  ctx.beginPath();
  const start = pointAtLength(contour, lo);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < points.length; i++) {
    if (cum[i] > lo && cum[i] < hi) ctx.lineTo(points[i].x, points[i].y);
  }
  const end = pointAtLength(contour, hi);
  ctx.lineTo(end.x, end.y);
}

/** Точка контура на заданной длине пути от начала обхода. */
function pointAtLength(contour, length) {
  const { points, cum, total } = contour;
  const clamped = Math.max(0, Math.min(total, length));
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= clamped) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[Math.min(points.length - 1, lo + 1)];
  const span = cum[lo + 1] - cum[lo];
  const u = span > 1e-9 ? (clamped - cum[lo]) / span : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/**
 * Живое золото ступенями. Каждый сегмент заливается ОДНИМ цветом: градиент
 * между тонами читался лучше, но повторная отрисовка того же кадра давала
 * другой пиксель — накопление цвета в 2D-canvas не детерминировано, а от этого
 * зависит совпадение предпросмотра и экспорта. Ступени идут через ~8 px
 * контура, поэтому переход тона не виден, зато кадр воспроизводится побитово.
 */
function goldStroke(ctx, tSec, motion) {
  const contour = frameContour(0);
  const steps = frameGoldSteps(tSec, goldSegmentCount(contour.total), { motion });
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
  const count = steps.length;
  for (let i = 0; i < count; i++) {
    const from = i / count, to = (i + 1) / count;
    ctx.strokeStyle = rgba(steps[i].color, 1);
    // Сегменты стыкуются встык, без нахлёста: нахлёст даёт двойное наложение,
    // и повторная отрисовка кадра расходилась на 179 px. При lineJoin: round
    // стык закрыт без щели и без двойной альфы.
    for (const part of framePathSpan(from, to)) {
      contourPointsFor(ctx, part.from, part.to);
      ctx.stroke();
    }
  }
}

function drawFrame(ctx, cue) {
  if (cue.visible <= 0.003) return;
  const tSec = Number.isFinite(cue.local) ? cue.local : 0;
  const motion = Number.isFinite(cue.motion) ? cue.motion : 1;
  ctx.save();
  ctx.globalAlpha = cue.visible * .9;
  // Периметр внешнего контура около 5560 px; запас нужен и для скруглённых
  // углов, иначе последняя часть левой стороны не дорисуется.
  const frameLength = 6000;
  ctx.setLineDash([Math.max(.001, frameLength * cue.frame), frameLength]);
  // Позолота с тонкой тёмной кромкой: кромка даёт объём, иначе рамка — линия.
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(33,13,5,.65)';
  framePath(ctx, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,226,170,.18)'; ctx.lineWidth = 1.2;
  framePath(ctx, -1.8); ctx.stroke();
  // Живое золото: тон переливается по контуру и медленно смещается.
  ctx.setLineDash([]);
  goldStroke(ctx, tSec, motion);
  // Внутренние кромки видны только когда рамка уже проявилась.
  if (cue.frame > 0.02) {
    ctx.strokeStyle = 'rgba(255,239,197,.55)'; ctx.lineWidth = .7;
    framePath(ctx, 1.5); ctx.stroke();
    ctx.globalAlpha = cue.visible * .4; ctx.lineWidth = 1;
    framePath(ctx, 10); ctx.stroke();
    ctx.globalAlpha = cue.visible * .9;
  }
  ctx.setLineDash([]);

  // Блик идёт ПО самой линии рамки: он подсвечивает участок контура, а не
  // кладёт поверх повёрнутую плашку (из-за неё на угле торчала полоса наружу).
  const run = cue.local * .105 - .022 * Math.sin(cue.local * .52);
  const pulse = .5 + .5 * Math.sin(1.1 + 1.4 * Math.sin(cue.local * .23));
  const strength = cue.frame * Math.min(1, cue.motion) * (.4 + .6 * pulse);
  if (strength > 0.01) {
    drawFrameGlint(ctx, frameGlint((run % 1 + 1) % 1, { strength, length: 260 }), cue.visible);
  }

  // Небольшие ювелирные акценты на углах появляются вместе с рамкой.
  ctx.globalAlpha = cue.visible * cue.frame * .7; ctx.fillStyle = '#e8cc96';
  for (const [x, y] of [[112, 42], [1808, 42], [112, 1038], [1808, 1038]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  }
  ctx.restore();
}

/**
 * Свечение вдоль участка контура. Заливкой полосы вдоль линии не сделать — у
 * линии нет толщины, — поэтому блик рисуется обводкой участка.
 *
 * Затухание к концам задаётся не градиентом и не маской, а короткими
 * флэт-сегментами одинаковой яркости: градиенты и смешивание по маске ломали
 * повторяемость кадра (2009 px расхождения между двумя отрисовками одного и
 * того же времени). Плотность сегментов постоянна, поэтому яркость меняется
 * только за счёт их цвета, и кадр воспроизводится побитово.
 */
function drawFrameGlint(ctx, glint, alpha) {
  if (alpha <= 0.003 || !glint.parts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  const layers = [
    [glint.halo * .62, 11, [255, 198, 128]],
    [glint.core * .55, 4.5, [255, 226, 168]],
    [glint.core * .42, 2, [255, 246, 220]],
  ];
  const pieces = 40;
  for (const [a, width, rgb] of layers) {
    const top = a * alpha;
    if (top <= 0.004) continue;
    ctx.lineWidth = width;
    for (const part of glint.parts) {
      const span = part.to - part.from;
      for (let i = 0; i < pieces; i++) {
        const u0 = i / pieces, u1 = (i + 1) / pieces;
        const strength = (glintFalloff(u0, glint.sharpness) + glintFalloff(u1, glint.sharpness)) / 2;
        if (strength <= 0.008) continue;
        ctx.strokeStyle = rgba(rgb, top * strength);
        // Нахлёст ровно в один кусок: сегменты не должны ни расходиться, ни
        // накладываться дважды — двойное наложение меняет яркость на стыке.
        contourPointsFor(ctx, part.from + span * u0, part.from + span * u1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// Fixed seed and fixed coordinates make the ambient glints reproducible for
// frame-accurate seeks and offline renders.
let seed = 0xA17B3;
const AMBER_PARTICLES = Array.from({ length: 74 }, (_, i) => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const x = 54 + (seed / 0x100000000) * 1812;
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const y = 55 + (seed / 0x100000000) * 970;
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return { x, y, radius: 0.7 + (seed / 0x100000000) * 1.8, phase: i * 2.3999632297, cycles: 1 + (i % 4) };
});

// Частица рисуется спрайтом, а не через shadowBlur: размытие тени в canvas2D
// дорого и линейно растёт с числом частиц (здесь их 74 и до 8 кадров на секунду
// экран не жалеет). Спрайт даёт тот же мягкий ореол одним drawImage.
const SPRITE_SIZE = 32;
let amberSprite = null;
function getAmberSprite() {
  if (amberSprite) return amberSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  const r = SPRITE_SIZE / 2;
  const glow = ctx.createRadialGradient(r, r, 0, r, r, r);
  // Те же стопы, что были в shadowColor '#ffbe66' + shadowBlur: ядро, ореол, ноль.
  glow.addColorStop(0, 'rgba(255,217,149,1)');
  glow.addColorStop(.34, 'rgba(255,200,120,.62)');
  glow.addColorStop(.62, 'rgba(255,190,102,.22)');
  glow.addColorStop(1, 'rgba(255,190,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  amberSprite = canvas;
  return canvas;
}

/** Warm moving light and subtle amber dust, deterministic at any seek time.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} time
 * @param {number} [motion]
 * @param {number} [period]
 */
export function drawAmberAtmosphere(ctx, time, motion = 1, period = 20) {
  const power = clamp(Number.isFinite(motion) ? motion : 1);
  if (power <= 0) return;
  const cycle = Math.max(0, time);
  const duration = Math.max(0.1, period);
  const angle = Math.PI * 2 * cycle / duration;
  const x = 960 - 760 * Math.cos(angle);
  const y = 325 + Math.sin(angle + Math.PI / 3) * 150;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 12, x, y, 650);
  glow.addColorStop(0, `rgba(255,190,105,${0.105 * power})`);
  glow.addColorStop(0.28, `rgba(248,148,75,${0.055 * power})`);
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BASE_FRAME.width, BASE_FRAME.height);

  // A soft narrow ray shifts with the hotspot; low contrast preserves title/logo legibility.
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  const ray = ctx.createLinearGradient(-430, 0, 430, 0);
  ray.addColorStop(0, 'rgba(255,190,105,0)');
  ray.addColorStop(0.5, `rgba(255,205,135,${0.025 * power})`);
  ray.addColorStop(1, 'rgba(255,190,105,0)');
  ctx.fillStyle = ray;
  ctx.fillRect(-430, -155, 860, 310);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const sprite = getAmberSprite();
  // Спрайт заменяет радиус ~1.4 px плюс shadowBlur 5–12: ореол той же ширины,
  // но одним drawImage без размытия. Множитель подобран по площади: тень
  // покрывала ~30 тыс. px на кадр, спрайт — столько же, иначе выигрыш съедается.
  const spriteScale = 6;
  for (const particle of AMBER_PARTICLES) {
    const twinkle = 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(angle * particle.cycles + particle.phase));
    const dx = (particle.x - x) / 470, dy = (particle.y - y) / 330;
    const beamCatch = Math.exp(-0.5 * (dx * dx + dy * dy));
    const alpha = power * twinkle * (0.26 + beamCatch * 0.48);
    const radius = particle.radius * (0.65 + twinkle * 0.65 + beamCatch * 0.35);
    const size = radius * spriteScale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, particle.x - size / 2, particle.y - size / 2, size, size);
    if (twinkle > 0.84) {
      ctx.globalAlpha = (twinkle - 0.84) * power * 1.45;
      ctx.fillStyle = '#ffd995';
      ctx.fillRect(particle.x - 3.5, particle.y - 0.45, 7, 0.9);
      ctx.fillRect(particle.x - 0.45, particle.y - 3.5, 0.9, 7);
    }
  }
  ctx.restore();
}

/**
 * Занавес поверх кадра и рамки. Ткань висит у левой кромки, поэтому она
 * перекрывает позолоту — так и должно быть: это передний план.
 * Ширина и амплитуда качания задаются настройками сцены.
 */
function drawCurtain(ctx, cue, image, settings) {
  if (cue.curtain <= 0.003) return;
  const width = Number.isFinite(settings.curtainWidth) ? settings.curtainWidth : 476;
  const h = BASE_FRAME.height;
  const slide = -width * 0.17 * (1 - cue.curtain);
  const sway = Number.isFinite(cue.curtainSway) ? cue.curtainSway : 0;
  ctx.save();
  ctx.globalAlpha = cue.visible * cue.curtain;
  ctx.drawImage(image, slide + sway, 0, width, h);
  ctx.restore();
}

/**
 * Рамка и занавес. Занавес рисуется ПОСЛЕ рамки, то есть висит поверх неё:
 * раньше он лежал под позолотой, и создавалось впечатление, что рамка
 * проступает сквозь ткань. Ткань — передний план, рамка — за ним.
 */
export function drawPartnersDecor(ctx,cue,settings,curtainImage) {
  // Ветви и циркуль уже находятся в изображении фона, занавес — отдельный PNG.
  if (settings.frameVisible !== false) drawFrame(ctx,cue);
  if (curtainImage && settings.curtainVisible !== false) drawCurtain(ctx,cue,curtainImage,settings);
}
