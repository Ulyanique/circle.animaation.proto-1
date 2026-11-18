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

// ── Глиттер ────────────────────────────────────────────────────────────────
// Это не звёзды: у крупинок нет лучей и крестиков, нет ровного «неба» из точек.
// Глиттер — плотная россыпь мельчайших крупинок металла в воздухе, каждая
// вспыхивает на мгновение. Чтобы кадр не читался как звёздное небо, россыпь
// живёт не по всему полю, а вдоль светового покрова — там, где свет ложится на
// пыль в воздухе, — и распределена неравномерно.
const FLECK_SIZE = 24;
/** @type {HTMLCanvasElement|null} */
let fleckSprite = null;
/** Круглая крупинка: плотное ядро 1–2 px и очень короткая мягкая кромка. */
function getFleckSprite() {
  if (fleckSprite) return fleckSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FLECK_SIZE;
  const ctx = canvas.getContext('2d');
  const c = FLECK_SIZE / 2;
  const core = ctx.createRadialGradient(c, c, 0, c, c, c);
  core.addColorStop(0, 'rgba(255,255,252,1)');
  core.addColorStop(.30, 'rgba(255,244,220,.80)');
  core.addColorStop(.62, 'rgba(255,216,158,.20)');
  core.addColorStop(1, 'rgba(255,196,120,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, FLECK_SIZE, FLECK_SIZE);
  fleckSprite = canvas;
  return canvas;
}

// Фиксированный сид: кадр воспроизводится побитово на любой перемотке.
let seed = 0xA17B3;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };

// Плотность россыпи: у источников света крупинок больше, к краям меньше — так
// слой читается как пыль в луче, а не как ровное звёздное поле.
const lightDensity = (x, y) => {
  const a = Math.exp(-((x - 1140) ** 2 + (y - 150) ** 2) / (2 * 620 ** 2));
  const b = Math.exp(-((x - 900) ** 2 + (y - 980) ** 2) / (2 * 560 ** 2));
  return 0.22 + 0.78 * Math.min(1, a + b);
};

const GLITTER = [];
// Отбор с плотностью: пока не набрали нужное число крупинок. Сид фиксирован,
// поэтому раскладка одинакова в каждом кадре и в экспорте.
while (GLITTER.length < 1150) {
  const x = 60 + rand() * 1800;
  const y = 70 + rand() * 950;
  if (rand() > lightDensity(x, y)) continue;
  const r = rand();
  GLITTER.push({
    x, y,
    // Крупинка глиттера мельче «пылинки»: 1,5–4 px в кадре 1920. Крупнее —
    // уже звезда, а не блеск металла.
    size: 0.45 + r * r * 1.35,
    phase: rand() * Math.PI * 2,
    // Вспышки быстрые и вразнобой: глиттер — это мерцание, а не ровное свечение.
    speed: 0.8 + rand() * 2.6,
    // Короткая вспышка и небольшое число одновременных искр: глиттер «звенит»,
    // а не висит ровным полем точек.
    duty: 0.07 + rand() * 0.15,
    // Собственное микродвижение: крупинки не приколоты к месту.
    drift: (rand() - 0.5) * 10,
    sway: 2 + rand() * 6,
  });
}

/**
 * Тёплый свет кадра и глиттер в воздухе. Свет — только мягкие рассеянные
 * покровы: ни конусов с гранями, ни лучей, ни ярких «точек-прожекторов».
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} time
 * @param {number} [motion]
 * @param {number} [period]
 * @param {Array<{x:number,y:number,w:number,h:number}>} [protect] зоны, где
 *   глиттер гасится: текст и знак должны оставаться читаемыми
 */
export function drawAmberAtmosphere(ctx, time, motion = 1, period = 20, protect = []) {
  const power = clamp(Number.isFinite(motion) ? motion : 1);
  if (power <= 0) return;
  const W = BASE_FRAME.width, H = BASE_FRAME.height;
  const cycle = Math.max(0, time);
  const duration = Math.max(0.1, period);
  const angle = Math.PI * 2 * cycle / duration;
  const breathe = 0.85 + 0.15 * Math.sin(angle);

  ctx.save();
  // 1. Покров сверху-справа: широкий и очень мягкий. Он не «ездит» по кадру,
  //    а дышит — свет должен лежать на фоне, а не бегать по нему.
  const wash = ctx.createRadialGradient(1140, 150, 40, 1140, 150, 900);
  wash.addColorStop(0, `rgba(255,208,150,${0.062 * power * breathe})`);
  wash.addColorStop(0.34, `rgba(246,168,104,${0.030 * power * breathe})`);
  wash.addColorStop(0.7, `rgba(200,108,64,${0.014 * power})`);
  wash.addColorStop(1, 'rgba(190,90,54,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // 2. Второй покров снизу: держит объём в нижней половине, чтобы верх не был
  //    единственной засветкой.
  const under = ctx.createRadialGradient(900, H - 90, 30, 900, H - 90, 760);
  under.addColorStop(0, `rgba(255,186,116,${0.045 * power})`);
  under.addColorStop(0.45, `rgba(220,122,74,${0.022 * power})`);
  under.addColorStop(1, 'rgba(170,76,48,0)');
  ctx.fillStyle = under;
  ctx.fillRect(0, 0, W, H);

  // 3. Третий покров — вытянутое сияние вдоль диагонали кадра. Это тоже
  //    радиальный градиент в сжатой системе координат: у него нет рёбер,
  //    поэтому на фоне не появляются полосы-плашки.
  ctx.save();
  ctx.translate(980, 520);
  ctx.rotate(-0.6);
  ctx.scale(1.55, 0.85);
  const veil = ctx.createRadialGradient(0, 0, 20, 0, 0, 620);
  veil.addColorStop(0, `rgba(255,210,156,${0.030 * power * breathe})`);
  veil.addColorStop(0.55, `rgba(244,170,110,${0.014 * power})`);
  veil.addColorStop(1, 'rgba(220,130,80,0)');
  ctx.fillStyle = veil;
  ctx.fillRect(-700, -700, 1400, 1400);
  ctx.restore();

  // 4. Глиттер: много мелких крупинок с короткими вспышками.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fleck = getFleckSprite();
  for (const grain of GLITTER) {
    const phase = angle * grain.speed / (Math.PI * 2) + grain.phase;
    const t = ((phase % 1) + 1) % 1;
    // Вспышка короткая и резкая: крупинка именно вспыхивает, а не светится.
    const flash = Math.max(0, 1 - Math.abs(t - 0.5) / (grain.duty * 0.5));
    if (flash <= 0.03) continue;
    const brightness = Math.pow(flash, 1.15);
    const px = grain.x + Math.sin(cycle * 0.4 + grain.phase) * grain.sway;
    const py = grain.y + Math.cos(cycle * 0.3 + grain.phase * 1.7) * grain.sway * 0.6 - grain.drift;
    if (py < 60 || py > H - 30) continue;
    let guard = 1;
    for (const zone of protect) {
      if (px > zone.x - 24 && px < zone.x + zone.w + 24 &&
          py > zone.y - 18 && py < zone.y + zone.h + 18) { guard = 0; break; }
    }
    if (!guard) continue;
    const size = grain.size * (2.6 + brightness * 4.0);
    const alpha = power * brightness * (0.62 + brightness * 0.55);
    if (alpha <= 0.02) continue;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(fleck, px - size / 2, py - size / 2, size, size);
  }
  ctx.restore();
}

/**
 * Занавес поверх кадра и рамки. Ткань висит у левой кромки, поэтому она
 * перекрывает позолоту — так и должно быть: это передний план.
 * Ширина и амплитуда качания задаются настройками сцены.
 */
/**
 * «Дыхание» фона: медленный циклический наезд ±0.8 % и вертикальный дрейф
 * 3 px за круг. Фаза берётся по длине цикла, поэтому на шве значения совпадают
 * с первым кадром, а seek остаётся детерминированным. Запас масштаба больше
 * дрейфа, поэтому кромка фото не оголяется ни на одной фазе.
 */
export function drawBreathingBackground(ctx, background, w, h, local, cycle) {
  if (!background) { ctx.fillStyle = "#22070b"; ctx.fillRect(0, 0, w, h); return; }
  const period = Number.isFinite(cycle) && cycle > 0 ? cycle : 26;
  const angle = (Math.PI * 2 * (Number.isFinite(local) ? local : 0)) / period;
  const breath = 1.014 + 0.008 * Math.sin(angle);
  const drift = 3 * Math.sin(angle + 1.1);
  const dw = w * breath, dh = h * breath;
  ctx.drawImage(background, (w - dw) / 2, (h - dh) / 2 + drift, dw, dh);
}

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
