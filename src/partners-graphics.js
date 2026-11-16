import { BASE_FRAME } from "./scenes/catalog.js";
import { frameGold, frameGlint, framePathPoint } from "./partners-motion.js";
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

// Контур рамки строится по точкам framePathPoint(), а не через
// quadraticCurveTo. Квадратичная кривая на угле заметно отличается от истинной
// дуги (до 15 px), и золото с кромкой расходились бы между собой.
function contourPath(ctx, from = 0, to = 1, samples = 480, inset = 0) {
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const at = from + (to - from) * (i / samples);
    const p = framePathPoint(at, inset);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
}
// Обратная совместимость: прежние вызовы framePath(ctx, inset) рисуют весь контур.
function framePath(ctx, inset) { contourPath(ctx, 0, 1, 480, inset); }

const GOLD_DARK = [167, 121, 66];   // тёмная бронза
const GOLD_BASE = [226, 187, 124];  // базовое золото
const GOLD_LIGHT = [255, 243, 214]; // светлое золото
function goldAt(tone, light = 1) {
  // tone < 0 тянет к бронзе, tone > 0 — к светлому золоту.
  const to = tone < 0 ? GOLD_DARK : GOLD_LIGHT;
  const k = Math.min(1, Math.abs(tone));
  const mix = [0, 1, 2].map(i =>
    Math.max(0, Math.min(255, Math.round((GOLD_BASE[i] + (to[i] - GOLD_BASE[i]) * k) * light))));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}
const rgbOf = (color) => color.match(/\d+/g).map(Number);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/**
 * Живое золото: контур режется на сегменты, каждый заливается линейным
 * градиентом между тонами на своих концах. Цвета на стыках совпадают точно,
 * поэтому швов не видно, а тон гуляет по всему периметру.
 * Пунктир тут не подходит: dash считается по длине пути, а длина дуг на углах
 * не совпадает с расчётной — получались зазоры и наложения.
 */
function goldStroke(ctx, tSec, motion, segments = 72) {
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  const toneAt = (at) => {
    const g = frameGold(tSec, at, { motion });
    return rgbOf(goldAt(g.tone, g.light));
  };
  const step = 1 / segments;
  const samples = 8;
  for (let i = 0; i < segments; i++) {
    const a0 = i * step, a1 = (i + 1) * step;
    const c0 = toneAt(a0), c1 = toneAt(a1);
    // Градиент вдоль хорды сегмента — на таком шаге он читается как вдоль дуги.
    const p0 = framePathPoint(a0), p1 = framePathPoint(a1);
    const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    g.addColorStop(0, rgba(c0, 1));
    g.addColorStop(1, rgba(c1, 1));
    ctx.strokeStyle = g;
    contourPath(ctx, a0, a1, samples);
    ctx.stroke();
  }
}

function drawFrame(ctx, cue) {
  if (cue.visible <= 0.003) return;
  const tSec = Number.isFinite(cue.local) ? cue.local : 0;
  const motion = Number.isFinite(cue.motion) ? cue.motion : 1;
  ctx.save();
  ctx.globalAlpha = cue.visible * .9;
  // Периметр внешнего контура около 5550 px; запас нужен и для скруглённых
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

  // Блик, бегущий по ВСЕМУ контуру. Раньше это было одно размытое пятно на
  // верхней кромке — оно не двигалось и читалось как игрушка. Здесь полоса
  // идёт по периметру, самосветится и поворачивается вместе с касательной.
  // Скорость не постоянная: ровный обход по периметру читается как метроном, и
  // именно это делало блик игрушечным. Синусоидальная добавка к пути ускоряет и
  // замедляет его, но производная всюду положительна — блик не откатывается.
  const run = cue.local * .105 - .022 * Math.sin(cue.local * .52);
  const pulse = .5 + .5 * Math.sin(1.1 + 1.4 * Math.sin(cue.local * .23));
  const strength = cue.frame * Math.min(1, cue.motion) * (.4 + .6 * pulse);
  if (strength > 0.01) {
    const glint = frameGlint((run % 1 + 1) % 1, { strength, length: 220, width: 8 });
    drawFrameGlint(ctx, glint, cue.visible);
  }

  // Небольшие ювелирные акценты на углах появляются вместе с рамкой.
  ctx.globalAlpha = cue.visible * cue.frame * .7; ctx.fillStyle = '#e8cc96';
  for (const [x, y] of [[112, 42], [1808, 42], [112, 1038], [1808, 1038]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
  }
  ctx.restore();
}

/** Один блик: ореол, тело и яркое ядро — всё вытянуто вдоль касательной. */
function drawFrameGlint(ctx, glint, alpha) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(glint.x, glint.y);
  ctx.rotate(glint.angle * Math.PI / 180);
  // Ядро намеренно не выводится в чистый белый: длинная полоса 255-го уровня
  // читается как засветка, а не как отблеск металла. Максимум ~0.72.
  const layers = [
    [glint.halo * alpha * .9, glint.haloLength, glint.haloWidth, [255, 198, 128]],
    [glint.core * alpha * .42, glint.coreLength, glint.coreWidth + 2, [255, 226, 168]],
    [glint.core * alpha * .3, glint.coreLength * .38, Math.max(1.4, glint.coreWidth * .55), [255, 246, 220]],
  ];
  for (const [a, length, width, rgb] of layers) {
    if (a <= 0.004) continue;
    const g = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    g.addColorStop(0, rgba(rgb, 0));
    g.addColorStop(.3, rgba(rgb, a * .5));
    g.addColorStop(.5, rgba(rgb, a));
    g.addColorStop(.7, rgba(rgb, a * .5));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    const half = Math.max(1, width / 2);
    ctx.fillRect(-length / 2, -half, length, half * 2);
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

export function drawPartnersDecor(ctx,cue,settings) {
  // Ветви и циркуль уже находятся в изображении фона, штора — отдельный PNG.
  if (settings.frameVisible !== false) drawFrame(ctx,cue);
}
