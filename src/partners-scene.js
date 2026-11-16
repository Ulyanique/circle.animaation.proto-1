import * as THREE from 'three';
import backgroundUrl from './assets/partners/bg.jpg';
import curtainUrl from './assets/partners/shtora.png';
import proelectroUrl from './assets/partners/proelectro.svg';
import proelectroschitUrl from './assets/partners/proelectroschit.svg';
import promrukavUrl from './assets/partners/promrukav.svg';
import keazUrl from './assets/partners/keaz.svg';
import { partnersCues, drawPartnersDecor, drawAmberAtmosphere } from './partners-graphics.js';
import { computePhase } from './timeline.js';
import { BASE_FRAME } from './scenes/catalog.js';
import { masterSize, masterId } from './output-profile.js';
import { fontName } from './fonts.js';
import { DEFAULT_QUALITY, isQualityPreset, suggestedQuality } from './quality-presets.js';

const loadImage = url => new Promise(resolve => {
  if (!url) { resolve(null); return; }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});

let backgroundCanvas, curtainImage;
const builtinMarks = {};

// Золотая заливка использует альфу SVG/PNG, а не прямоугольную белую плашку.
export function renderPartnerMark(image, style = 'gold') {
  const w = Math.max(1, image.naturalWidth || image.width || 600);
  const h = Math.max(1, image.naturalHeight || image.height || 200);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.max(1, Math.round(1200 * h / w));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (style !== 'original') {
    ctx.globalCompositeOperation = 'source-in';
    const gold = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gold.addColorStop(0, '#f8e6bd'); gold.addColorStop(.42, '#e5c48b');
    gold.addColorStop(.72, '#b88b4f'); gold.addColorStop(1, '#ebd19b');
    ctx.fillStyle = gold; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
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
  ['organizer1', 'organizer2', 'partner1', 'partner2'].forEach((key, i) => {
    if (marks[i]) {
      builtinMarks[key] = {
        gold: renderPartnerMark(marks[i], 'gold'),
        original: renderPartnerMark(marks[i], 'original'),
      };
    }
  });
  return images.every(Boolean);
});
export const loadPartnersBackground = () => imageReady;

// Кэш пользовательских логотипов (data:image/...) по URL + стилю тиснения.
const customLogoCache = new Map();
const customLogoPending = new Set();

function resolveCustomLogo(dataUrl, style, onReady) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
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
    if (typeof url !== 'string' || !url.startsWith('data:image/')) return;
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
   * Фон и постоянный градиент света не меняются за цикл и не зависят от времени.
   * Раньше они перерисовывались каждый кадр: уменьшение фото 2752×1536 до 1920
   * и полноэкранный градиент стоят дороже всей анимации вместе.
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
    if (background) ctx.drawImage(background, 0, 0, w, h);
    else { ctx.fillStyle = "#22070b"; ctx.fillRect(0, 0, w, h); }
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
    ctx.drawImage(staticLayer, 0, 0, w, h);
    ctx.restore();
    drawAmberAtmosphere(ctx, phase.local, (data.motion ?? 1) * visible, phase.cycle);
    if (data.curtainVisible !== false && curtainImage) {
      ctx.save(); ctx.globalAlpha = visible * cue.curtain;
      ctx.drawImage(curtainImage, -80 * (1 - cue.curtain) + cue.curtainSway, 0, 476, h);
      ctx.restore();
    }
    drawPartnersDecor(ctx, cue, data);
    const displayFont = fontName(cfg.typography?.font || 'cormorant-garamond');
    const text = (value, x, y, font, color, alpha, maxWidth, entry = 1) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font; ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      ctx.fillText(String(value ?? ''), x, y + 22 * (1 - entry), maxWidth); ctx.restore();
    };
    const gold = '#e9ca91', warm = '#d2ac70', ivory = '#f6e4be';
    const title = visible * cue.title;
    const heading = String(data.title ?? '').toLocaleUpperCase('ru-RU');
    // The upper-right foliage narrows the visual safe area, so the title block
    // sits optically left and stays clear of the leaves rather than filling the frame.
    text(heading, 900, 160, `600 96px "${displayFont}", serif`, ivory, title, 940, cue.title);
    text(data.subtitle, 900, 270, `400 49px "${displayFont}", serif`, gold, title, 1000, cue.title);
    const ornament = (y, alpha, width, center = 960) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = warm; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(center - width, y); ctx.lineTo(center - 16, y); ctx.moveTo(center + 16, y); ctx.lineTo(center + width, y); ctx.stroke();
      ctx.translate(center, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
    };
    ornament(330, title * .7, 280 * cue.title, 900);
    const label = (value, x, y, alpha, entry) => {
      text(value, x, y, '600 24px Manrope, sans-serif', warm, alpha, 460, entry);
    };
    const defaults = { organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит', partner1: 'Промрукав', partner2: 'КЭАЗ' };
    const style = data.logoStyle === 'original' ? 'original' : 'gold';
    const company = (key, x, y, entry) => {
      const value = data[key];
      const customLogo = resolveCustomLogo(data[`${key}Logo`], style, () => {
        if (window.__logo?.activeScene?.id === 'partners' && window.__logo?.cfg?.playback?.paused) {
          window.__logo.renderAt(window.__logo.time);
        }
      });
      const isDefaultName = String(value ?? '').trim().toLocaleLowerCase('ru') === defaults[key].toLocaleLowerCase('ru');
      const logo = customLogo || (isDefaultName ? builtinMarks[key]?.[style] : null);
      if (!logo) {
        text(value, x, y, '600 52px Manrope, sans-serif', ivory, visible * entry, 440, entry);
        return;
      }
      const scale = Math.min(440 / logo.width, 105 / logo.height);
      const lw = logo.width * scale, lh = logo.height * scale;
      ctx.save(); ctx.globalAlpha = visible * entry;
      ctx.beginPath(); ctx.rect(x - 250 * entry, y - 80, 500 * entry, 160); ctx.clip();
      ctx.drawImage(logo, x - lw / 2, y - lh / 2 + 22 * (1 - entry), lw, lh); ctx.restore();
    };
    label(data.organizerLabel, 690, 401, visible * cue.organizerLabel, cue.organizerLabel);
    label(data.coorganizerLabel, 1230, 401, visible * cue.organizerLabel, cue.organizerLabel);
    company('organizer1', 690, 495, cue.organizer);
    company('organizer2', 1230, 495, cue.organizerSecond);
    ornament(613, visible * cue.separator * .55, 420 * cue.separator);
    label(data.partnerLabel, 960, 690, visible * cue.partnerLabel, cue.partnerLabel);
    company('partner1', 690, 785, cue.partner);
    company('partner2', 1230, 785, cue.partnerSecond);
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
