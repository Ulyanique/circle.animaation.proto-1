import * as THREE from 'three';
import backgroundUrl from './assets/partners/bg.jpg';
import curtainUrl from './assets/partners/shtora.png';
import proelectroUrl from './assets/partners/proelectro.svg';
import proelectroschitUrl from './assets/partners/proelectroschit.svg';
import promrukavUrl from './assets/partners/promrukav.svg';
import keazUrl from './assets/partners/keaz.svg';
import { partnersCues, drawPartnersDecor, drawAmberAtmosphere, drawBreathingBackground } from './partners-graphics.js';
import { glintSpan, reveal, easeOutBack, pairLayout } from './partners-motion.js';
import { computePhase } from './timeline.js';
import { BASE_FRAME } from './scenes/catalog.js';
import { masterSize, masterId } from './output-profile.js';
import { fontName } from './fonts.js';
import { DEFAULT_QUALITY, isQualityPreset, suggestedQuality } from './quality-presets.js';
import { PARTNERS_DEFAULTS } from './scenes/partners.js';
import { textSafeLeft, fitFontSize } from './text-safe-area.js';

const loadImage = url => new Promise(resolve => {
  if (!url) { resolve(null); return; }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});

let backgroundCanvas, curtainImage;
const builtinMarks = {};
/** Исходные изображения встроенных логотипов: нужны, чтобы доделать второй стиль. */
const builtinMarkSource = {};
/** Активный стиль тиснения: его же читает сцена при отрисовке. */
function activeLogoStyle() {
  return partnersLogoStyle === 'original' ? 'original' : 'gold';
}
let partnersLogoStyle = 'gold';

/** Логотип нужного стиля; второй вариант готовится один раз при первом запросе. */
function builtinMark(key, style) {
  const ready = builtinMarks[key];
  if (!ready) return null;
  if (ready[style]) return ready[style];
  const source = builtinMarkSource[key];
  if (!source) return null;
  ready[style] = renderPartnerMark(source, style);
  return ready[style];
}

/** Сцена сообщает стиль заранее, чтобы первый кадр не платил за подготовку. */
export function setPartnersLogoStyle(style) {
  partnersLogoStyle = style === 'original' ? 'original' : 'gold';
  for (const key of Object.keys(builtinMarks)) {
    if (builtinMarkSource[key] && !builtinMarks[key][partnersLogoStyle]) {
      builtinMarks[key][partnersLogoStyle] = renderPartnerMark(builtinMarkSource[key], partnersLogoStyle);
    }
  }
}

// На экране логотип не шире MARK_MAX_WIDTH и не выше MARK_MAX_HEIGHT (см. company()).
// Готовить его в 1200 px значило держать 14× лишних пикселей и вчетверо больше
// памяти; масштаб 2× оставляем на смену мастер-профиля и чёткость.
// Буфер для блика по золоту: пересобирается в размер знака, поэтому создаётся
// один раз, а не на каждый кадр (в кадре до четырёх знаков).
let glintBuffer = null;
function glintCanvas() {
  if (!glintBuffer) glintBuffer = document.createElement('canvas');
  return glintBuffer;
}

/**
 * Блик, проходящий по золоту знака. Рисуется на копии знака: маска из
 * источника оставляет блеск только на самом рисунке, поэтому полоса не
 * вылезает на фон и не требует знания контура.
 * @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} logo
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {number|null} span доля ширины, где сейчас полоса (см. glintSpan)
 * @param {number} alpha
 */
export function drawMarkGlint(ctx, logo, x, y, w, h, span, alpha) {
  if (span == null || alpha <= 0.002) return;
  const buffer = glintCanvas();
  if (buffer.width !== logo.width || buffer.height !== logo.height) {
    buffer.width = logo.width; buffer.height = logo.height;
  }
  const bctx = buffer.getContext('2d');
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = 'source-over';
  bctx.clearRect(0, 0, buffer.width, buffer.height);
  bctx.drawImage(logo, 0, 0);
  bctx.globalCompositeOperation = 'source-in';
  // Узкая тёплая полоса с мягкими краями: ширина ~ 18 % знака, наклон 12°.
  const bandWidth = buffer.width * 0.18;
  const center = span * buffer.width;
  const grad = bctx.createLinearGradient(center - bandWidth, 0, center + bandWidth, 0);
  grad.addColorStop(0, 'rgba(255,246,219,0)');
  grad.addColorStop(.42, 'rgba(255,250,232,.85)');
  grad.addColorStop(.5, 'rgba(255,255,246,1)');
  grad.addColorStop(.58, 'rgba(255,250,232,.85)');
  grad.addColorStop(1, 'rgba(255,246,219,0)');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, buffer.width, buffer.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(buffer, x, y, w, h);
  ctx.restore();
}

// Ось композиции и центры колонок. Заголовок, подзаголовок и линия под ним
// раньше стояли на 900 — на 60 px левее оси кадра, из-за чего вся верхняя часть
// выглядела смещённой, хотя ярусы уже стояли по центру. Теперь ось одна на кадр.
const CONTENT_CENTER = BASE_FRAME.width / 2;
const COLUMN_LEFT = 690;
const COLUMN_RIGHT = 1230;

// Ширина поднята с 440: у ПРОэлектрощит и КЭАЗ соотношение сторон 4,8:1 и 5,3:1,
// поэтому прежний потолок ширины срезал им ВЫСОТУ (92 и 83 px против 105 у
// соседей) — в одном ярусе знаки выглядели разного веса. Столбцы разнесены на
// 540 px, так что 500 px по ширине не сближает группы.
const MARK_MAX_WIDTH = 500;
const MARK_MAX_HEIGHT = 105;
const MARK_SUPERSAMPLE = 2;

// Контейнер яруса: 1010 px по центру кадра. Знаки прижимаются к его внешним
// краям, между ними остаётся не меньше PAIR_INNER_GAP. Ширина общая для обоих
// ярусов, поэтому внешние края всех четырёх знаков встают в единые колонки.
// 1010 подобрано так, чтобы самый широкий ярус (411+500 у организаторов) влезал
// в полный размер без ужима: 411+500+90 = 1001. При 900 знаки ужимались на 11 %,
// при 840 зазор схлопывался и пары срастались в один блок.
const PAIR_WIDTH = 1010;
const PAIR_INNER_GAP = 90;

// Золотая заливка использует альфу SVG/PNG, а не прямоугольную белую плашку.
/**
 * Готовит знак к отрисовке: подгоняет под экранный размер и заливает золотом.
 *
 * Прозрачные поля вокруг рисунка срезаются: исходные SVG приходят с разным
 * запасом (у одного 6 % сверху, у другого 20 %), и знаки на экране получались
 * разного веса при одинаковой высоте блока. По срезанным границам вызывающая
 * сторона может выровнять их по оптической массе, а не по пустому полю.
 */
export function renderPartnerMark(image, style = 'gold') {
  const w = Math.max(1, image.naturalWidth || image.width || 600);
  const h = Math.max(1, image.naturalHeight || image.height || 200);
  // Целевой размер считается тем же правилом, что и при отрисовке кадра.
  const fit = Math.min(MARK_MAX_WIDTH / w, MARK_MAX_HEIGHT / h);
  const full = document.createElement('canvas');
  full.width = Math.max(1, Math.round(w * fit * MARK_SUPERSAMPLE));
  full.height = Math.max(1, Math.round(h * fit * MARK_SUPERSAMPLE));
  const fullCtx = full.getContext('2d');
  fullCtx.drawImage(image, 0, 0, full.width, full.height);
  if (style !== 'original') {
    fullCtx.globalCompositeOperation = 'source-in';
    const gold = fullCtx.createLinearGradient(0, 0, 0, full.height);
    gold.addColorStop(0, '#f8e6bd'); gold.addColorStop(.42, '#e5c48b');
    gold.addColorStop(.72, '#b88b4f'); gold.addColorStop(1, '#ebd19b');
    fullCtx.fillStyle = gold; fullCtx.fillRect(0, 0, full.width, full.height);
  }
  return full;
}

/**
 * Плотные границы непрозрачного рисунка в пределах канваса. Нужны, чтобы
 * выровнять знаки по видимому размеру и не считать блик по пустому полю.
 * Возвращает доли 0..1; при неудаче — весь канвас.
 */
export function markBounds(canvas) {
  const whole = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  let ctx;
  try { ctx = canvas.getContext('2d', { willReadFrequently: true }); } catch (e) { return whole; }
  if (!ctx) return whole;
  const { width, height } = canvas;
  let data;
  try { data = ctx.getImageData(0, 0, width, height).data; } catch (e) { return whole; }
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      // Порог 24 из 255 отсекает почти прозрачную кромку сглаживания.
      if (data[row + x * 4 + 3] > 24) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return whole;
  return { x: minX / width, y: minY / height, width: (maxX - minX + 1) / width, height: (maxY - minY + 1) / height };
}

const imageReady = Promise.all([backgroundUrl, curtainUrl, proelectroUrl, proelectroschitUrl, promrukavUrl, keazUrl].map(loadImage)).then(images => {
  const [background, curtain, ...marks] = images;
  if (background) {
    // Подгонка с сохранением пропорций (центр кадра), без растяжения.
    backgroundCanvas = document.createElement('canvas');
    const w = BASE_FRAME.width, h = BASE_FRAME.height;
    backgroundCanvas.width = w; backgroundCanvas.height = h;
    const scale = Math.max(w / background.naturalWidth, h / background.naturalHeight);
    const dw = background.naturalWidth * scale, dh = background.naturalHeight * scale;
    backgroundCanvas.getContext('2d').drawImage(background, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  curtainImage = curtain;
  // Логотип готовится под тот стиль, который выбран в настройках; второй вариант
  // доделывается при первом обращении (см. builtinMark). Иначе на старте
  // выполнялась двойная работа и вдвое больше канвасов в памяти.
  const style = activeLogoStyle();
  ['organizer1', 'organizer2', 'partner1', 'partner2'].forEach((key, i) => {
    if (marks[i]) builtinMarkSource[key] = marks[i];
    if (marks[i]) builtinMarks[key] = { [style]: renderPartnerMark(marks[i], style) };
  });
  return images.every(Boolean);
});
export const loadPartnersBackground = () => imageReady;

/**
 * Изображения программы: фон, занавес и встроенные знаки. Заставки отдельных
 * спонсоров берут их отсюда же — вторая копия картинок в памяти не нужна.
 * @returns {{background: HTMLCanvasElement|null, curtain: HTMLImageElement|null}}
 */
export function partnersAssets() {
  return { background: backgroundCanvas ?? null, curtain: curtainImage ?? null };
}

/**
 * Готовый знак для заставки спонсора: встроенный золотой (или свой файл).
 * Возвращает канвас в том же виде, в каком знаки рисуются в «Спонсорах»,
 * поэтому блик и тиснение совпадают.
 * @param {string} key @param {string} [customUrl] @param {string} [style]
 */
export function partnersMark(key, customUrl, style = 'gold') {
  const resolved = style === 'original' ? 'original' : 'gold';
  if (typeof customUrl === 'string' && customUrl.startsWith('data:image/') && customUrl.length <= MAX_LOGO_DATA_URL) {
    const cacheKey = `${resolved}:${customUrl}`;
    const cached = customLogoCache.get(cacheKey);
    if (cached) return cached;
    resolveCustomLogo(customUrl, resolved);
    return null;
  }
  return builtinMark(key, resolved);
}

/** Заголовок и подзаголовок по умолчанию: у заставок они те же, что у «Спонсоров». */
export function partnerDefaults() {
  return PARTNERS_DEFAULTS.partners;
}

// Кэш пользовательских логотипов (data:image/...) по URL + стилю тиснения.
const customLogoCache = new Map();
const customLogoPending = new Set();

// Та же граница, что и при разборе настроек (config.js): гигантский data:image
// из ссылки #cfg не должен попадать ни в кэш, ни в отрисовку.
const MAX_LOGO_DATA_URL = 4 * 1024 * 1024;

function resolveCustomLogo(dataUrl, style, onReady) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > MAX_LOGO_DATA_URL) return null;
  const cacheKey = `${style}:${dataUrl}`;
  if (customLogoCache.has(cacheKey)) return customLogoCache.get(cacheKey);
  if (!customLogoPending.has(cacheKey)) {
    customLogoPending.add(cacheKey);
    loadImage(dataUrl).then(img => {
      customLogoPending.delete(cacheKey);
      if (img) {
        if (customLogoCache.size > 32) customLogoCache.clear();
        customLogoCache.set(cacheKey, renderPartnerMark(img, style));
        onReady?.();
      }
    });
  }
  return null;
}

/** Предварительно декодирует пользовательские data:image логотипы перед оффлайн-экспортом. */
export async function preloadPartnerCustomLogos(partnersCfg) {
  if (!partnersCfg || typeof partnersCfg !== 'object') return;
  const style = partnersCfg.logoStyle === 'original' ? 'original' : 'gold';
  const tasks = ['organizer1', 'organizer2', 'partner1', 'partner2'].map(async key => {
    const url = partnersCfg[`${key}Logo`];
    if (typeof url !== 'string' || !url.startsWith('data:image/') || url.length > MAX_LOGO_DATA_URL) return;
    const cacheKey = `${style}:${url}`;
    if (customLogoCache.has(cacheKey)) return;
    const img = await loadImage(url);
    if (img) customLogoCache.set(cacheKey, renderPartnerMark(img, style));
  });
  await Promise.all(tasks);
}

/**
 * Сцена 04 «Спонсоры»: лёгкий автономный WebGL-адаптер без тяжёлого 3D-графа
 * основной сцены и с двойной буферизацией 2D-полотна (0 аллокаций canvas на кадр).
 */
export class PartnersScene {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.isIntro = false;
    this.contourWaves = null;
    // Стиль известен из настроек сразу: готовим только нужный вариант логотипов.
    setPartnersLogoStyle(cfg.partners?.logoStyle);
    this._quality = suggestedQuality(masterId());
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const master = masterSize();
    this._buffers = [0, 1].map(() => {
      const c = document.createElement('canvas');
      c.width = master.width; c.height = master.height;
      return { canvas: c, ctx: c.getContext('2d') };
    });
    this._bufferIndex = 0;
    this.card = this._buffers[0].canvas;
    this.cardCtx = this._buffers[0].ctx;
    this._textures = this._buffers.map(({ canvas }) => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    });
    this.cardTexture = this._textures[0];

    this.cardScene = new THREE.Scene();
    this.cardCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    this.cardCamera.position.z = 1;
    this.cardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.cardTexture, toneMapped: false })
    );
    this.cardScene.add(this.cardMesh);
    this._w = 0; this._h = 0;
    this.resize();
  }

  resize() {
    const { width, height } = masterSize();
    if (this._w !== width || this._h !== height) {
      this._w = width; this._h = height;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      for (const buf of this._buffers) {
        buf.canvas.width = width;
        buf.canvas.height = height;
        buf.ctx = buf.canvas.getContext('2d');
      }
      // Статический слой привязан к разрешению мастера — пересобрать.
      this._staticLayer = null;
      this._staticLayerKey = "";
    }
  }

  /**
   * Постоянный градиент света не меняется за цикл и не зависит от времени.
   * Раньше они перерисовывались каждый кадр: полноэкранный градиент стоит
   * дороже всей анимации вместе. Фото сюда больше не запекается: оно живёт
   * отдельным слоем с «дыханием» (drawBreathingBackground), а готовый холст
   * 1920×1080 масштабируется за кадр дёшево.
   */
  _buildStaticLayer(master, background) {
    // Ключ обязан учитывать наличие фона: первые кадры могут пройти до загрузки
    // фото, и закэшированная «пустая» подложка иначе останется навсегда.
    const key = `${master.width}x${master.height}|${background ? "bg" : "empty"}`;
    if (this._staticLayer && this._staticLayerKey === key) return this._staticLayer;
    const w = BASE_FRAME.width, h = BASE_FRAME.height;
    /** @type {any} */
    const layer = this._staticLayer?.canvas ?? document.createElement("canvas");
    layer.width = master.width; layer.height = master.height;
    const ctx = layer.getContext("2d");
    ctx.setTransform(master.width / w, 0, 0, master.height / h, 0, 0);
    const light = ctx.createRadialGradient(720, 90, 20, 850, 400, 900);
    light.addColorStop(0, "rgba(255,190,139,.13)");
    light.addColorStop(.45, "rgba(197,97,76,.035)");
    light.addColorStop(1, "rgba(0,0,0,.16)");
    ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
    this._staticLayer = layer;
    this._staticLayerKey = key;
    return layer;
  }

  get quality() { return this._quality; }
  setQuality(id) {
    const next = isQualityPreset(id) ? id : DEFAULT_QUALITY;
    if (next === this._quality) return false;
    this._quality = next;
    return true;
  }
  setCaptionSource() {}
  setCaptionOverride() {}
  setCaptionVisible() {}

  update(t) {
    const master = masterSize();
    if (this._w !== master.width || this._h !== master.height) this.resize();
    // Чередуем два готовых холста: Chromium гарантированно обновляет WebGL-текстуру
    // без ежекадрового создания полноразмерного DOM-элемента.
    this._bufferIndex = 1 - this._bufferIndex;
    const target = this._buffers[this._bufferIndex];
    this.card = target.canvas;
    this.cardCtx = target.ctx;
    // Each reusable buffer owns its own texture. Swapping maps avoids mutating
    // a live texture's image source while WebGL still has it bound.
    this.cardTexture = this._textures[this._bufferIndex];
    this.cardMesh.material.map = this.cardTexture;

    const ctx = this.cardCtx, w = BASE_FRAME.width, h = BASE_FRAME.height, cfg = this.cfg, tl = cfg.timeline;
    ctx.setTransform(master.width / w, 0, 0, master.height / h, 0, 0);
    const phase = computePhase(t, tl), data = cfg.partners;
    const cue = partnersCues(phase, tl, data.motion ?? 1), visible = cue.visible;
    this._blackFrame = visible <= 0;

    // Непрозрачная чёрная заливка уже стирает прошлый кадр: отдельный clearRect
    // поверх 2 млн пикселей — лишняя работа на каждом кадре.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h);
    if (visible <= 0) { this.cardTexture.needsUpdate = true; return; }
    // Фон и постоянный свет берутся готовым слоем: масштабирование фото и
    // полноэкранный градиент выполняются один раз, а не 60 раз в секунду.
    const staticLayer = this._buildStaticLayer(master, backgroundCanvas);
    ctx.save(); ctx.globalAlpha = visible;
    drawBreathingBackground(ctx, backgroundCanvas, w, h, phase.local, phase.cycle);
    ctx.drawImage(staticLayer, 0, 0, w, h);
    ctx.restore();
    // Зоны защиты: заголовок с подзаголовком сверху и оба яруса знаков.
    drawAmberAtmosphere(ctx, phase.local, (data.motion ?? 1) * visible, phase.cycle, [
      { x: 380, y: 80, w: 1160, h: 290 },
      { x: 400, y: 380, w: 1120, h: 500 },
    ]);
    // Занавес рисуется внутри декора, после рамки: ткань — передний план и
    // должна перекрывать позолоту, а не лежать под ней.
    drawPartnersDecor(ctx, cue, data, curtainImage);
    const displayFont = fontName(cfg.typography?.font || 'cormorant-garamond');
    const text = (value, x, y, font, color, alpha, maxWidth, entry = 1) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font; ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      ctx.fillText(String(value ?? ''), x, y + 22 * (1 - entry), maxWidth); ctx.restore();
    };
    const gold = '#e9ca91', warm = '#d2ac70', ivory = '#f6e4be';
    const title = visible * cue.title;
    const heading = String(data.title ?? '').toLocaleUpperCase('ru-RU');
    // Заголовок из золотой фольги: вертикальный металлический градиент делает
    // буквы похожими на тиснение, а по нему раз в цикл проходит свет.
    // Раньше заголовок был залит ровным цветом и читался как обычный текст.
    const foilGradient = (top, bottom) => {
      const foil = ctx.createLinearGradient(0, top, 0, bottom);
      foil.addColorStop(0, '#fff9ea');
      foil.addColorStop(.28, '#f7e3b7');
      foil.addColorStop(.52, '#eed4a3');
      foil.addColorStop(.74, '#d5ae74');
      foil.addColorStop(.9, '#b98f56');
      foil.addColorStop(1, '#e6cd9c');
      return foil;
    };
    /**
     * Заголовок из золотой фольги. Кегль приходит из безопасной зоны, поэтому
     * строка не может уйти под занавес; blur-радиус и градиент считаются от
     * него же, иначе металл «разъезжается» при смене размера.
     */
    const drawFoilTitle = (value, x, y, alpha, size) => {
      if (alpha <= 0.003) return;
      const drop = 22 * (1 - cue.title);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${size}px "${displayFont}", serif`;
      const half = size * 0.5;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      // Базовый слой: металл по высоте буквы (от светлого верха к тёмному низу).
      ctx.fillStyle = foilGradient(y - half, y + half);
      ctx.fillText(value, x, y + drop);
      // Второй слой — сам блик. Аддитивно, поэтому металл не «выцветает»,
      // а именно вспыхивает на проходе полосы.
      const sweep = glintSpan(phase.local, { start: 5.6, span: 1.9, from: -0.12, to: 1.12 });
      if (sweep != null) {
        const width = ctx.measureText(value).width;
        const left = x - width / 2, band = width * 0.13;
        const at = left + width * sweep;
        const shine = ctx.createLinearGradient(at - band * 2.4, 0, at + band * 2.4, 0);
        shine.addColorStop(0, 'rgba(255,255,255,0)');
        shine.addColorStop(.42, 'rgba(255,252,236,.42)');
        shine.addColorStop(.5, 'rgba(255,255,255,.68)');
        shine.addColorStop(.58, 'rgba(255,252,236,.42)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = shine;
        ctx.fillText(value, x, y + drop);
      }
      ctx.restore();
    };
    // Блок заголовка стоит строго на оси кадра: смещение «оптически влево»
    // читалось как небрежность, а не как замысел.
    // Безопасная зона: занавес висит поверх кадра, его ширина задаётся в
    // настройках. Раньше предел ширины был числом 1100, и при широкой шторе
    // первая буква заголовка оказывалась под тканью.
    // Граница берётся ДЛЯ СТРОКИ заголовка: кромка ткани диагональная, и на
    // высоте заголовка она дальше «средней» доли ширины — общая граница
    // пропускала первую букву под ткань при широкой шторе.
    const safe = textSafeLeft(data, { atY: 160 - 48 });
    const titleFit = fitFontSize({
      size: 96, min: 44,
      measure: (size) => {
        ctx.font = `600 ${size}px "${displayFont}", serif`;
        return ctx.measureText(heading).width;
      },
    }, safe);
    drawFoilTitle(heading, CONTENT_CENTER, 160, title, titleFit.size);
    const subtitleSafe = textSafeLeft(data, { atY: 270 - 25 });
    text(data.subtitle, CONTENT_CENTER, 270, `400 49px "${displayFont}", serif`, gold, title,
      Math.min(1080, 2 * (960 - subtitleSafe)), cue.title);
    // Линия расходится от центра, а ромб появляется последним и чуть крупнее:
    // взгляд успевает пройти по кадру сверху вниз, а не схватить всё сразу.
    const ornament = (y, alpha, width, center = 960, diamond = 1) => {
      if (width <= 0.5) return;
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = warm; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(center - width, y); ctx.lineTo(center - 16, y); ctx.moveTo(center + 16, y); ctx.lineTo(center + width, y); ctx.stroke();
      if (diamond > 0) {
        ctx.translate(center, y); ctx.rotate(Math.PI / 4);
        const size = 4 * (0.55 + 0.45 * diamond);
        ctx.globalAlpha = alpha * diamond;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
      }
      ctx.restore();
    };
    ornament(330, title * .7, 280 * cue.rule, CONTENT_CENTER, cue.rule);
    // Разрядка у мелких капсов — типографский приём, который сразу отделяет
    // «дорогую» вёрстку от обычной. letterSpacing поддерживается Chromium;
    // если его нет, подпись просто останется без разрядки.
    const trackedLabel = (value, x, y, alpha, entry) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 24px Manrope, sans-serif';
      ctx.fillStyle = warm;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      const supportsTracking = 'letterSpacing' in ctx;
      if (supportsTracking) ctx.letterSpacing = '5px';
      // Компенсация: разрядка добавляет хвостовой пробел справа, поэтому
      // центрированный текст уезжает — сдвигаем на половину разрядки.
      const shift = supportsTracking ? 2.5 : 0;
      ctx.fillText(String(value ?? ''), x + shift, y + 22 * (1 - entry), 460);
      if (supportsTracking) ctx.letterSpacing = '0px';
      ctx.restore();
    };
    const label = (value, x, y, alpha, entry) => {
      trackedLabel(value, x, y, alpha, entry);
    };
    const defaults = { organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит', partner1: 'Промрукав', partner2: 'КЭАЗ' };
    const style = data.logoStyle === 'original' ? 'original' : 'gold';
    // Смена стиля в настройках доготовит нужный вариант один раз, а не каждый кадр.
    if (style !== partnersLogoStyle) setPartnersLogoStyle(style);
    // Знак входит не «проявлением», а движением: поднимается на 26 px, чуть
    // увеличиваясь, и садится с мягким перелётом. Текст рядом идёт следом,
    // чтобы группа читалась как единое целое, а не как два независимых слоя.
    /** Знак из настроек (свой файл) либо встроенный, если имя не меняли. */
    const customLogoFor = (key) => {
      const custom = resolveCustomLogo(data[`${key}Logo`], style, () => {
        if (window.__logo?.activeScene?.id === 'partners' && window.__logo?.cfg?.playback?.paused) {
          window.__logo.renderAt(window.__logo.time);
        }
      });
      const isDefault = String(data[key] ?? '').trim().toLocaleLowerCase('ru') === defaults[key].toLocaleLowerCase('ru');
      return custom || (isDefault ? builtinMark(key, style) : null);
    };
    // Знаки готовим один раз на кадр: и для замера пары, и для отрисовки.
    // Раньше company() и замер звали подготовку по отдельности.
    const marks = {
      organizer1: customLogoFor('organizer1'), organizer2: customLogoFor('organizer2'),
      partner1: customLogoFor('partner1'), partner2: customLogoFor('partner2'),
    };
    // Ширина знака на экране без отрисовки: нужна, чтобы построить пару
    // симметрично. Показной масштаб тот же, что в company().
    const markWidth = (key) => {
      const logo = marks[key];
      if (!logo) return 0;
      return logo.width * Math.min(MARK_MAX_WIDTH / logo.width, MARK_MAX_HEIGHT / logo.height);
    };
    const company = (key, x, y, entry, glintAt, phaseIdx, fit = 1) => {
      const value = data[key];
      const logo = marks[key];
      // Мягкий подъём с перелётом: p идёт 0→1, overshoot даёт «доезд».
      const p = entry <= 0 ? 0 : Math.min(1.06, easeOutBack(entry));
      const rise = (1 - Math.min(1, p)) * 26;
      if (!logo) {
        text(value, x, y, '600 52px Manrope, sans-serif', ivory, visible * Math.max(0, Math.min(1, p)), 440, Math.min(1, p));
        return;
      }
      // Ширина И высота считаются от ОДНОГО коэффициента. Раньше высота
      // бралась до ограничения пары, а ширина ужималась отдельно — правые
      // знаки (ПРОэлектрощит, КЭАЗ) выходили сжатыми по горизонтали в 1.25 и
      // 1.34 раза. Логотип искажать нельзя ни при каких раскладках.
      const scale = Math.min(MARK_MAX_WIDTH / logo.width, MARK_MAX_HEIGHT / logo.height) * fit;
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      // Масштаб группы: 0.955 → 1, на перелёте — до 1.008.
      // На удержании знак медленно «дышит» (±0.4 % размера и ±2 px по высоте):
      // у каждого своя фаза, поэтому группа не качается синхронно.
      const breathe = cue.idle * 0.004 * Math.sin(phase.local * 0.62 + phaseIdx * 1.7);
      const floatY = cue.idle * 2.1 * Math.sin(phase.local * 0.5 + phaseIdx * 2.1);
      const grow = 0.955 + 0.045 * p + breathe;
      const cx = x, cy = y + rise + floatY;
      ctx.save();
      ctx.globalAlpha = visible * Math.max(0, Math.min(1, p * 1.15));
      // Мягкая тень под знаком отделяет золото от винного фона и даёт глубину.
      if (cue.shadow > 0.01) {
        ctx.save();
        ctx.globalAlpha = visible * Math.min(1, p) * cue.shadow * 0.5;
        ctx.translate(cx, cy + lh * 0.52);
        ctx.scale(1, 0.22);
        const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, lw * 0.52);
        shadow.addColorStop(0, 'rgba(0,0,0,.55)');
        shadow.addColorStop(.6, 'rgba(0,0,0,.22)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadow;
        ctx.beginPath(); ctx.arc(0, 0, lw * 0.52, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.translate(cx, cy);
      ctx.scale(grow, grow);
      // Клип по кадру при входе остаётся: он не даёт знаку «вылезать» за блок.
      ctx.beginPath(); ctx.rect(-268, -80, 536, 160); ctx.clip();
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      // Блик проходит уже по проявленному знаку — иначе он светит в пустоту.
      drawMarkGlint(ctx, logo, -lw / 2, -lh / 2, lw, lh,
        glintSpan(phase.local, { start: glintAt, span: 0.62, from: -0.35, to: 1.35 }),
        visible * Math.min(1, p) * cue.glintStrength);
      // Второй проход на удержании — медленнее и тише. Разнесён по знакам,
      // чтобы свет «гулял» по группе, а не вспыхивал весь сразу.
      drawMarkGlint(ctx, logo, -lw / 2, -lh / 2, lw, lh,
        glintSpan(phase.local, { start: 7.4 + phaseIdx * 0.35, span: 1.15, from: -0.3, to: 1.3 }),
        visible * Math.min(1, p) * cue.holdGlint * 0.55);
      ctx.restore();
    };
    // Тёплая «подушка» под каждым ярусом: отделяет группу от фона и добавляет
    // глубины. Рисуется до знаков, поэтому знаки остаются резкими поверх света.
    const tierGlow = (cx, cy, rx, ry, alpha) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy); ctx.scale(1, ry / rx);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      glow.addColorStop(0, 'rgba(255,186,110,.16)');
      glow.addColorStop(.55, 'rgba(232,138,72,.07)');
      glow.addColorStop(1, 'rgba(200,100,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    tierGlow(CONTENT_CENTER, 495, 620, 190, visible * cue.shadow * .85);
    tierGlow(CONTENT_CENTER, 785, 620, 190, visible * cue.shadow * .7);
    // Ярус строится симметрично по КРАЯМ, а не центрированием на фиксированных
    // колонках: у знаков разные пропорции (3.6:1 у Промрукав, 5.4:1 у КЭАЗ), и
    // пара из блоков разной ширины читалась сдвинутой вправо — центр групп был
    // на оси, но зазор между ними 65 px против 20, а внешние поля 485 против 441.
    // Теперь поля по краям равны, и зазор в середине тоже.
    // Раскладка пары: общие внешние края, зазор в центре, при нехватке места —
    // один коэффициент на оба знака (см. pairLayout).
    const pairSlot = (leftKey, rightKey) => {
      const lw = markWidth(leftKey), rw = markWidth(rightKey);
      if (!lw && !rw) return { leftX: COLUMN_LEFT, rightX: COLUMN_RIGHT, fit: 1 };
      return pairLayout({
        center: CONTENT_CENTER, leftWidth: lw, rightWidth: rw,
        container: PAIR_WIDTH, gap: PAIR_INNER_GAP,
      });
    };
    const organizers = pairSlot('organizer1', 'organizer2');
    // Подписи идут по центрам своих знаков: они относятся к знаку, а не к колонке.
    label(data.organizerLabel, organizers.leftX, 401, visible * cue.organizerLabel, cue.organizerLabel);
    label(data.coorganizerLabel, organizers.rightX, 401, visible * cue.organizerLabel, cue.organizerLabel);
    // Блик идёт очередью уже по «севшему» знаку: 1.69+1.0 с — конец входа.
    company('organizer1', organizers.leftX, 495, cue.organizer, 2.75, 0, organizers.fit);
    company('organizer2', organizers.rightX, 495, cue.organizerSecond, 3.25, 1, organizers.fit);
    ornament(613, visible * cue.separator * .55, 420 * cue.separator, CONTENT_CENTER, cue.separator);
    label(data.partnerLabel, CONTENT_CENTER, 690, visible * cue.partnerLabel, cue.partnerLabel);
    const sponsors = pairSlot('partner1', 'partner2');
    company('partner1', sponsors.leftX, 785, cue.partner, 4.45, 2, sponsors.fit);
    company('partner2', sponsors.rightX, 785, cue.partnerSecond, 4.95, 3, sponsors.fit);
    this.cardTexture.needsUpdate = true;
  }

  render() {
    this.renderer.setRenderTarget(null);
    if (this._blackFrame) this.renderer.clear(true, true, true);
    else this.renderer.render(this.cardScene, this.cardCamera);
  }

  dispose() {
    this._textures.forEach(texture => texture.dispose());
    this.cardMesh.geometry.dispose();
    this.cardMesh.material.dispose();
    this.renderer.dispose();
  }
}
