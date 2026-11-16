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

// ── Частицы ────────────────────────────────────────────────────────────────
// Раньше каждая частица рисовалась мягким спрайтом 32×32, растянутым в 6 раз:
// на экране это давало размытые пятна — «блямбы». Блёстка читается иначе:
// крошечное яркое ядро и короткие лучи, а не широкий ореол. Поэтому рисуем
// звезду с четырьмя лучами по готовому спрайту и очень редко — с восемью
// (поворот на 45°). Детерминизм сохраняется: спрайты строятся один раз.
const STAR_SIZE = 64;
/** @type {HTMLCanvasElement|null} */
let starSprite = null;
/** Четырёхлучевая звезда: ядро + тонкие лучи, без широкого размытия. */
function getStarSprite() {
  if (starSprite) return starSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = STAR_SIZE;
  const ctx = canvas.getContext('2d');
  const c = STAR_SIZE / 2;
  // Ядро маленькое и яркое: именно оно читается как блеск.
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.24);
  core.addColorStop(0, 'rgba(255,252,238,1)');
  core.addColorStop(.45, 'rgba(255,228,170,.85)');
  core.addColorStop(1, 'rgba(255,206,132,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, STAR_SIZE, STAR_SIZE);
  // Лучи: длинные по горизонтали и вертикали, короткие по диагонали.
  const ray = (length, width, alpha) => {
    const g = ctx.createLinearGradient(c, c, c, c - length);
    g.addColorStop(0, `rgba(255,246,222,${alpha})`);
    g.addColorStop(.45, `rgba(255,224,163,${alpha * .5})`);
    g.addColorStop(1, 'rgba(255,206,132,0)');
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = g;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-width, 0); ctx.lineTo(0, -length); ctx.lineTo(width, 0); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  // Лучи заметно толще прежних: при отрисовке спрайт сжимается в 3–4 раза, и
  // тонкая линия в 1 px превращалась в едва различимую точку.
  ray(c * 0.98, STAR_SIZE * 0.075, 1);
  ray(c * 0.46, STAR_SIZE * 0.085, .55);
  starSprite = canvas;
  return canvas;
}


/**
 * Лучи блёстки. Спрайт даёт ядро, но его лучи при сжатии превращаются в точку,
 * поэтому «звёздность» рисуется отдельно: четыре тонких клина с затуханием.
 * Каждый клин — один fillRect с линейным градиентом, поэтому слой остаётся
 * дешёвым и детерминированным (без blur и без накопления альфы).
 */
function drawSparkleRays(ctx, x, y, length, width, alpha, diagonal = false) {
  if (alpha <= 0.01 || length <= 1) return;
  for (let i = 0; i < (diagonal ? 8 : 4); i++) {
    const angle = Math.PI / 2 * i + (diagonal ? Math.PI / 4 : 0);
    const len = diagonal ? length * 0.55 : length;
    const half = Math.max(0.6, width * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,248,226,${alpha})`);
    g.addColorStop(0.35, `rgba(255,224,166,${alpha * 0.42})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    // Треугольник вместо прямоугольника: к концу луч сходится в точку.
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Координаты и фазы фиксированы сидом: кадр воспроизводится побитово на любом
// перемотке и в экспорте.
let seed = 0xA17B3;
const AMBER_PARTICLES = Array.from({ length: 96 }, (_, i) => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const x = 54 + (seed / 0x100000000) * 1812;
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const y = 55 + (seed / 0x100000000) * 970;
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const r = seed / 0x100000000;
  return {
    x, y,
    // Разброс размера: мелкая пыль и несколько крупных блёсток — так слой
    // читается как глубина, а не как ровное поле точек.
    size: 0.35 + r * r * 1.9,
    phase: i * 2.3999632297,
    // Разная частота мерцания: звёзды не должны вспыхивать в такт.
    cycles: 0.6 + (i % 5) * 0.45,
    // Часть частиц «в фокусе» — у них есть лучи, остальные мельче и мягче.
    star: r > 0.62,
  };
});

/**
 * Тёплый свет и янтарная пыль. Свет больше не плоское пятно: он собран из
 * трёх слоёв — мягкое свечение фона, широкий объёмный конус луча и яркое
 * ядро блика, которое медленно гуляет по кадру.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} time
 * @param {number} [motion]
 * @param {number} [period]
 * @param {Array<{x:number,y:number,w:number,h:number}>} [protect] зоны, где
 *   блёстки гасятся: текст и знак должны оставаться читаемыми
 */
export function drawAmberAtmosphere(ctx, time, motion = 1, period = 20, protect = []) {
  const power = clamp(Number.isFinite(motion) ? motion : 1);
  if (power <= 0) return;
  const W = BASE_FRAME.width, H = BASE_FRAME.height;
  const cycle = Math.max(0, time);
  const duration = Math.max(0.1, period);
  const angle = Math.PI * 2 * cycle / duration;
  // Источник света медленно ходит по верхней трети кадра.
  const x = 960 - 700 * Math.cos(angle);
  const y = 250 + Math.sin(angle + Math.PI / 3) * 120;

  // 1. Общее тёплое свечение вокруг источника.
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 720);
  glow.addColorStop(0, `rgba(255,196,116,${0.115 * power})`);
  glow.addColorStop(0.22, `rgba(250,152,80,${0.062 * power})`);
  glow.addColorStop(0.62, `rgba(214,104,62,${0.022 * power})`);
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 2. Луч: узкий у источника, расширяется книзу. Рисуется радиальным
  //    градиентом в сжатой системе координат — так он мягкий по ВСЕМ краям.
  //    Раньше это был многоугольник с линейным градиентом только по высоте:
  //    боковые грани читались как плоские полосы.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.16);
  ctx.scale(0.30, 1);
  const beam = ctx.createRadialGradient(0, 0, 30, 0, 0, 900);
  beam.addColorStop(0, `rgba(255,214,150,${0.20 * power})`);
  beam.addColorStop(0.25, `rgba(255,196,124,${0.10 * power})`);
  beam.addColorStop(0.6, `rgba(240,158,92,${0.035 * power})`);
  beam.addColorStop(1, 'rgba(220,130,70,0)');
  ctx.fillStyle = beam;
  ctx.fillRect(-900, -900, 1800, 1800);
  ctx.restore();

  // 2б. Узкий плотный шлейф у самого источника: он и даёт ощущение объёма.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(-0.16);
  ctx.scale(0.10, 1);
  const shaft = ctx.createRadialGradient(0, 0, 10, 0, 0, 520);
  shaft.addColorStop(0, `rgba(255,240,208,${0.26 * power})`);
  shaft.addColorStop(0.4, `rgba(255,214,150,${0.10 * power})`);
  shaft.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = shaft;
  ctx.fillRect(-520, -520, 1040, 1040);
  ctx.restore();

  // 3. Ядро блика — маленькое, но плотное: именно оно даёт «стекло» и объём.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(x, y, 0, x, y, 120);
  core.addColorStop(0, `rgba(255,246,224,${0.30 * power})`);
  core.addColorStop(0.3, `rgba(255,214,150,${0.12 * power})`);
  core.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = core;
  ctx.fillRect(x - 130, y - 130, 260, 260);

  // 4. Пыль: звёздочки вместо размытых пятен.
  ctx.globalCompositeOperation = 'lighter';
  const star = getStarSprite();
  for (const particle of AMBER_PARTICLES) {
    // Мерцание — по синусу, но с резким «вспыхиванием» на пике: звёзды
    // вспыхивают, а не плавно качаются.
    const wave = 0.5 + 0.5 * Math.sin(angle * particle.cycles + particle.phase);
    const twinkle = Math.pow(wave, 2.2);
    const dx = (particle.x - x) / 520, dy = (particle.y - y) / 380;
    const beamCatch = Math.exp(-0.5 * (dx * dx + dy * dy));
    // Блёстка поверх буквы читается как дефект, а не как эффект: в зонах
    // текста и знака свет гасится, но не исчезает совсем.
    let guard = 1;
    for (const zone of protect) {
      if (particle.x > zone.x - 40 && particle.x < zone.x + zone.w + 40 &&
          particle.y > zone.y - 30 && particle.y < zone.y + zone.h + 30) { guard = 0.18; break; }
    }
    const alpha = power * (0.22 + twinkle * 0.95) * (0.45 + beamCatch * 0.75) * guard;
    // Размер подобран по экрану: блёстка должна читаться как точка света, а не
    // как пылинка. Внутри луча — крупнее, на периферии мельче.
    // Размер в пикселях кадра 1920: блёстка читается как искра, а не как
    // прожектор. Ядро 6–22 px, лучи добавляют ещё полторы-две ширины.
    const size = particle.size * (6 + twinkle * 8 + beamCatch * 7);
    if (alpha <= 0.012) continue;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(star, particle.x - size / 2, particle.y - size / 2, size, size);
    if (particle.star) {
      // Длина лучей зависит от мерцания: звезда «раскрывается» на пике и
      // остаётся точкой в паузе. Диагональные лучи только у самых крупных.
      const glow = Math.min(1, ctx.globalAlpha);
      const length = size * (0.9 + twinkle * 1.2);
      ctx.save();
      ctx.globalAlpha = 1;
      drawSparkleRays(ctx, particle.x, particle.y, length, Math.max(0.9, size * 0.13),
        glow * (0.22 + twinkle * 0.5));
      if (particle.size > 1.7 && twinkle > 0.72) {
        drawSparkleRays(ctx, particle.x, particle.y, length * 0.62, Math.max(0.8, size * 0.09),
          glow * (twinkle - 0.72) * 1.1, true);
      }
      ctx.restore();
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
