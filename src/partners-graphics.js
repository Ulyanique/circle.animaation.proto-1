import { BASE_FRAME } from "./scenes/catalog.js";
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
    organizerLabel:entry(.35,.9), organizer:entry(.65,1.55), organizerSecond:entry(.9,1.8),
    partnerLabel:entry(1.12,1.6), partner:entry(1.4,2.3), partnerSecond:entry(1.65,2.55),
    separator:entry(.9,1.55),
    light: smooth(.45,1.2,local)*(1-smooth(3.8,5.2,local))*m,
    glint: (.5 + .5*Math.sin(local*.39-1.2))*idle,
    leafMotion: idle*Math.sin(local*.48+.7),
    curtainSway: idle * Math.sin(local*.42)*8,
    foliageSway: idle * Math.sin(local*.35+1)*.012,
    compassSway: idle * Math.sin(local*.30+.4)*.008,
    motion:m,
  };
}

function framePath(ctx, inset) {
  const l=54+inset,r=1866-inset,t=42+inset,b=1038-inset,c=38;
  ctx.beginPath();ctx.moveTo(l+c,t);ctx.lineTo(r-c,t);
  ctx.quadraticCurveTo(r-c,t+c,r,t+c);ctx.lineTo(r,b-c);
  ctx.quadraticCurveTo(r-c,b-c,r-c,b);ctx.lineTo(l+c,b);
  ctx.quadraticCurveTo(l+c,b-c,l,b-c);ctx.lineTo(l,t+c);
  ctx.quadraticCurveTo(l+c,t+c,l+c,t);ctx.closePath();
}
function drawFrame(ctx,cue) {
  ctx.save();ctx.globalAlpha=cue.visible*.82;
  // Периметр внешнего контура около 5600 px; запас нужен и для
  // скруглённых углов, иначе последняя часть левой стороны не дорисуется.
  const frameLength=6000;
  ctx.setLineDash([Math.max(.001,frameLength*cue.frame),frameLength]);
  // Позолота с тонкой тёмной кромкой и движущимся отражением.
  ctx.lineWidth=5;ctx.strokeStyle='rgba(33,13,5,.65)';framePath(ctx,0);ctx.stroke();
  // Рамка рисуется в координатах базового кадра; контекст уже отмасштабирован
  // вызывающей стороной, поэтому берём размер из каталога, а не литерал.
  const gold=ctx.createLinearGradient(0,0,BASE_FRAME.width,BASE_FRAME.height);
  gold.addColorStop(0,'#805b34');gold.addColorStop(.25,'#d1ac70');
  gold.addColorStop(.48,'#f4dcaa');gold.addColorStop(.72,'#99703e');gold.addColorStop(1,'#d8b77f');
  ctx.strokeStyle=gold;ctx.lineWidth=2.5;framePath(ctx,0);ctx.stroke();
  ctx.strokeStyle='rgba(255,239,197,.5)';ctx.lineWidth=.7;framePath(ctx,1.5);ctx.stroke();
  ctx.globalAlpha=cue.visible*.37;ctx.lineWidth=1;framePath(ctx,10);ctx.stroke();
  ctx.setLineDash([]);
  // Небольшие ювелирные акценты на углах появляются вместе с рамкой.
  ctx.globalAlpha=cue.visible*cue.frame*.65;ctx.fillStyle='#e8cc96';
  for(const [x,y] of [[112,42],[1808,42],[112,1038],[1808,1038]]){
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore();
  }
  const x=180+1560*cue.glint;
  const glow=ctx.createRadialGradient(x,42,0,x,42,75);
  glow.addColorStop(0,'rgba(255,240,196,.32)');glow.addColorStop(1,'rgba(255,230,180,0)');
  ctx.globalAlpha=cue.visible*cue.frame*cue.motion*.65;ctx.fillStyle=glow;ctx.fillRect(x-75,0,150,117);
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
  for (const particle of AMBER_PARTICLES) {
    const twinkle = 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(angle * particle.cycles + particle.phase));
    const alpha = twinkle * power * 0.46;
    const radius = particle.radius * (0.65 + twinkle * 0.65);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd995';
    ctx.shadowColor = '#ffbe66';
    ctx.shadowBlur = 5 + radius * 5;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (twinkle > 0.84) {
      ctx.globalAlpha = (twinkle - 0.84) * power * 1.45;
      ctx.shadowBlur = 8;
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
