/** Длительность входа в сцену в реальных секундах. 0 — монтажная склейка.
 * @param {{transition?:{duration?:number}}} config */
export function transitionDuration(config) {
  const value = config.transition?.duration;
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : .9;
}

/** CSS ease-in-out: cubic-bezier(.42, 0, .58, 1), совпадает с переходом в DOM.
 * @param {number} progress */
export function transitionEase(progress) {
  const x = Math.min(1, Math.max(0, progress));
  if (x === 0 || x === 1) return x;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2, u = 1 - t;
    const bx = 3 * u * u * t * .42 + 3 * u * t * t * .58 + t * t * t;
    if (bx < x) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return t * t * (3 - 2 * t);
}

/**
 * Слои перехода на текущем прогрессе. Чистая функция: по ней рисуют и
 * предпросмотр, и экспорт, поэтому картинка не может разойтись.
 *
 * Почему не растворение и не провал в чёрное. Обе схемы проверены на кадрах:
 *  - cross-dissolve давал двойную экспозицию: на середине «ПРОэлектро»
 *    просвечивал сквозь текст входящей сцены — два заголовка разом читаются
 *    как грязь;
 *  - провал в тень убирал наложение, но давал 3–4 кадра ровной бурой мглы без
 *    содержания — это читается как пропуск кадра, а не как приём.
 *
 * Поэтому склейка идёт световой завесой: по кадру слева направо проходит
 * мягкая граница, ЗА которой уже входящая сцена, ПЕРЕД которой ещё уходящая.
 * В каждой точке кадра виден ровно один вид — наложения текстов нет по
 * построению. По самой границе идёт золотой свет: она читается как луч,
 * вытягивающий новую сцену из темноты, и это тот же занавес, что висит в кадре.
 *
 * Все слои рисуются только через source-over: тогда «нарисовать поверх кадра»
 * и «нарисовать в прозрачном оверлее поверх кадра» дают один результат, и
 * предпросмотр совпадает с экспортом. Режим `lighter` такое свойство ломает.
 *
 * @param {number} progress 0 — уходящий кадр цел, 1 — переход завершён
 * @returns {{outgoing:number, zoom:number, drift:number, edge:number, soft:number, tilt:number, edgeGlow:number, edgeCore:number}}
 */
export function transitionLook(progress) {
  const x = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const ease = transitionEase(x);
  // Мягкая граница в долях ширины кадра. Шире — граница «плывёт» и картинка
  // кажется мутной; уже — виден резкий шов.
  const soft = .105;
  // Наклон границы: строго вертикальная линия читается как полоса сканера,
  // наклонённая — как движущийся свет. 5 % ширины на высоту кадра.
  const tilt = .05;
  // Граница идёт от левого края за правый, с запасом на мягкость и наклон:
  // иначе на первом и последнем кадре остаётся полоса соседнего вида.
  const span = 1 + 2 * soft + 2 * tilt + .08;
  const edge = -soft - tilt - .04 + span * ease;
  // Свет вдоль границы: колокол по времени, чтобы на краях перехода его не было.
  const bell = Math.sin(Math.PI * x);
  return {
    // уходящий вид непрозрачен всю дорогу и снимается маской — не прозрачностью
    outgoing: x < 1 ? 1 : 0,
    // уходящий уезжает в глубину: наезд 2.2 % и подъём на 6 px
    zoom: 1 + .022 * ease,
    drift: -6 * ease,
    edge,
    soft,
    tilt,
    edgeGlow: .21 * Math.pow(bell, .8),
    edgeCore: .17 * Math.pow(bell, 1.2),
  };
}

/** Прозрачность зафиксированного кадра уходящей сцены на текущем кадре входа.
 * Завеса снимает уходящий вид маской, а не прозрачностью, поэтому здесь только
 * «есть кадр / нет кадра». Оставлено ради совместимости с прежним API.
 * @param {number} frame @param {number} fps @param {number} duration */
export function outgoingOpacity(frame, fps, duration) {
  return duration <= 0 ? 0 : transitionLook(frame / fps / duration).outgoing;
}

// Рабочее полотно для маски. Создаётся один раз и переиспользуется: на каждый
// кадр перехода нужно один раз собрать слой уходящего вида с мягкой границей.
/** @type {HTMLCanvasElement | null} */
let layerCanvas = null;
/** @type {CanvasRenderingContext2D | null} */
let layerCtx = null;
let layerW = 0, layerH = 0;

/**
 * Рабочее полотно под маску. Возвращает и полотно, и контекст: без обоих
 * мягкая завеса невозможна, и вызывающий код переходит на жёсткую границу.
 * @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D} | null}
 */
function scratchSurface(ctx, width, height) {
  const doc = ctx?.canvas?.ownerDocument || (typeof document === 'object' ? document : null);
  if (!doc || !width || !height) return null;
  if (!layerCanvas || !layerCtx) {
    const made = doc.createElement('canvas');
    const madeCtx = made.getContext('2d');
    if (!madeCtx) return null;
    layerCanvas = made;
    layerCtx = madeCtx;
  }
  // Проверка выше уже гарантирует непустые значения, но TS этого не видит
  // сквозь присваивание — сужаем явно.
  const canvas = layerCanvas;
  const target = layerCtx;
  if (!canvas || !target) return null;
  if (layerW !== width || layerH !== height) {
    canvas.width = width; canvas.height = height;
    layerW = width; layerH = height;
  }
  return { canvas, ctx: target };
}

/** Наложить переход поверх уже нарисованного входящего кадра.
 * Возвращает false после завершения перехода (или для склейки).
 * Один и тот же код рисует и экспорт (на непрозрачном кадре видео), и
 * предпросмотр (на прозрачном оверлее) — поэтому картинка совпадает.
 * @param {CanvasRenderingContext2D} ctx @param {CanvasImageSource} outgoing
 * @param {number} frame @param {number} fps @param {number} duration
 * @param {number} width @param {number} height */
export function drawOutgoingFrame(ctx, outgoing, frame, fps, duration, width, height) {
  if (duration <= 0) return false;
  const progress = frame / fps / duration;
  if (progress >= 1) return false;
  const look = transitionLook(progress);
  const edgeX = look.edge * width;
  const softX = look.soft * width;
  // Граница наклонена: сверху она левее, снизу правее.
  const tiltX = look.tilt * width;
  const surface = scratchSurface(ctx, width, height);
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    // 1. Слой уходящего вида. Сначала он кладётся целиком, затем из него
    //    вычитается всё, что левее мягкой границы. Так зона левее границы
    //    прозрачна и оттуда показывает уже нарисованная входящая сцена.
    if (look.outgoing > 0 && surface) {
      const lctx = surface.ctx;
      lctx.save();
      lctx.clearRect(0, 0, width, height);
      lctx.globalCompositeOperation = 'source-over';
      const cx = width / 2, cy = height / 2, s = look.zoom;
      lctx.drawImage(outgoing, cx - cx * s, cy - cy * s + look.drift, width * s, height * s);
      // destination-out: альфа 1 стирает, альфа 0 оставляет как есть.
      lctx.globalCompositeOperation = 'destination-out';
      const mask = lctx.createLinearGradient(edgeX - softX - tiltX / 2, 0, edgeX + softX + tiltX / 2, height);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = mask;
      lctx.fillRect(0, 0, width, height);
      lctx.restore();
      ctx.drawImage(surface.canvas, 0, 0, width, height);
    }
    // 2. Без рабочего полотна (среда без canvas) — честная жёсткая граница
    //    вместо мягкой: геометрия та же, читается резче, но кадр не ломается.
    if (look.outgoing > 0 && !surface) {
      const cx = width / 2, cy = height / 2, s = look.zoom;
      ctx.save();
      try {
        ctx.beginPath();
        ctx.moveTo(edgeX - tiltX / 2, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(edgeX + tiltX / 2, height);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(outgoing, cx - cx * s, cy - cy * s + look.drift, width * s, height * s);
      } finally {
        // Обрезка обязана сниматься даже при сбое отрисовки: иначе следующий
        // кадр экспорта унаследует чужой клип и половина кадра пропадёт.
        ctx.restore();
      }
    }
    // 3. Свет вдоль границы: широкое золотое свечение и яркое ядро.
    if (look.edgeGlow > .002) {
      const glowHalf = Math.max(softX * .9, 24);
      const glow = ctx.createLinearGradient(edgeX - glowHalf - tiltX / 2, 0, edgeX + glowHalf + tiltX / 2, height);
      glow.addColorStop(0, 'rgba(214,140,70,0)');
      glow.addColorStop(.5, `rgba(240,170,92,${look.edgeGlow.toFixed(3)})`);
      glow.addColorStop(1, 'rgba(214,140,70,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
    if (look.edgeCore > .002) {
      const core = Math.max(3, width * .004);
      const line = ctx.createLinearGradient(edgeX - core - tiltX / 2, 0, edgeX + core + tiltX / 2, height);
      line.addColorStop(0, 'rgba(255,206,136,0)');
      line.addColorStop(.5, `rgba(255,222,164,${look.edgeCore.toFixed(3)})`);
      line.addColorStop(1, 'rgba(255,206,136,0)');
      ctx.fillStyle = line;
      ctx.fillRect(0, 0, width, height);
    }
  } finally {
    ctx.restore();
  }
  return true;
}
