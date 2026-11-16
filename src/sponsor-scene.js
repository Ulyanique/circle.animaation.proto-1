import { BASE_FRAME } from "./scenes/catalog.js";
import { computePhase } from "./timeline.js";
import { sponsorCues, markBox, markGlintAt, markScaleFor, MARK_CENTER_Y, MARK_KEYS } from "./sponsor-motion.js";
import { textSafeLeft, fitFontSize } from "./text-safe-area.js";
import { easeOutBack, glintSpan } from "./partners-motion.js";
import { drawPartnersDecor, drawAmberAtmosphere, drawBreathingBackground } from "./partners-graphics.js";
import { partnersMark, partnersAssets, partnerDefaults, drawMarkGlint, loadPartnersBackground } from "./partners-scene.js";
import { DEFAULT_QUALITY, isQualityPreset, suggestedQuality } from "./quality-presets.js";
import { masterId, masterSize } from "./output-profile.js";
import { fontName } from "./fonts.js";
import * as THREE from "three";

/**
 * Заставка одного спонсора: «ЯНТАРНЫЙ ЦИРКУЛЬ» сверху, «Вечер ретроспектива»,
 * разделитель и КРУПНЫЙ знак спонсора по центру кадра.
 *
 * Почему отдельная сцена, а не вариант «Спонсоров». Там два яруса по два знака —
 * это общий список. Здесь кадр отдан одному логотипу: его показывают со сцены,
 * когда слово берёт конкретный спонсор, поэтому знак должен читаться с последнего
 * ряда. Общий фундамент при этом один и тот же: та же рамка с живым золотом, тот
 * же занавес поверх неё, то же тёплое свечение и тот же блик по золоту.
 *
 * Раскладка задана в долях базового кадра 1920×1080 и повторяет вертикаль
 * «Спонсоров»: заголовок 160, подзаголовок 270, разделитель 330. Отличие только
 * в размере знака — он занимает середину кадра, а не ярус из двух.
 */

/** Сцена заставки спонсора: тот же лёгкий 2D-каркас на WebGL-текстуре, что у «Спонсоров». */
export class SponsorScene {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.isIntro = false;
    this.contourWaves = null;
    this._quality = suggestedQuality(masterId());
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const master = masterSize();
    this._buffers = [0, 1].map(() => {
      const c = document.createElement("canvas");
      c.width = master.width; c.height = master.height;
      return { canvas: c, ctx: c.getContext("2d") };
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
    this._markKey = "";
    this._mark = null;
    this.resize();
    // Первый кадр может пройти до загрузки фона и знаков. Показ на паузе сам
    // не перерисуется, поэтому после загрузки просим один кадр заново.
    loadPartnersBackground().then(() => {
      if (window.__logo?.cfg?.playback?.paused) window.__logo.renderAt(window.__logo.time);
    });
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
        buf.ctx = buf.canvas.getContext("2d");
      }
      this._staticLayer = null;
      this._staticLayerKey = "";
    }
  }

  /** Фон и постоянный свет пересобираются только при смене разрешения. */
  _buildStaticLayer(master, background) {
    const key = `${master.width}x${master.height}|${background ? "bg" : "empty"}`;
    if (this._staticLayer && this._staticLayerKey === key) return this._staticLayer;
    const w = BASE_FRAME.width, h = BASE_FRAME.height;
    const layer = this._staticLayer?.canvas ?? document.createElement("canvas");
    layer.width = master.width; layer.height = master.height;
    const ctx = layer.getContext("2d");
    ctx.setTransform(master.width / w, 0, 0, master.height / h, 0, 0);
    // Фото не запекается: его ведёт drawBreathingBackground отдельным слоем.
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
    this._bufferIndex = 1 - this._bufferIndex;
    const target = this._buffers[this._bufferIndex];
    this.card = target.canvas;
    this.cardCtx = target.ctx;
    this.cardTexture = this._textures[this._bufferIndex];
    this.cardMesh.material.map = this.cardTexture;

    const ctx = this.cardCtx, w = BASE_FRAME.width, h = BASE_FRAME.height;
    const cfg = this.cfg, tl = cfg.timeline, data = cfg.sponsor ?? {};
    ctx.setTransform(master.width / w, 0, 0, master.height / h, 0, 0);
    const phase = computePhase(t, tl);
    const cue = sponsorCues(phase, tl, data.motion ?? 1);
    this._blackFrame = cue.visible <= 0;

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, w, h);
    if (cue.visible <= 0) { this.cardTexture.needsUpdate = true; return; }

    const assets = partnersAssets();
    const staticLayer = this._buildStaticLayer(master, assets.background);
    ctx.save(); ctx.globalAlpha = cue.visible;
    drawBreathingBackground(ctx, assets.background, w, h, phase.local, phase.cycle);
    ctx.drawImage(staticLayer, 0, 0, w, h);
    ctx.restore();
    // Свет живёт по своей огибающей: входит вместе с кадром, но уходит
    // последним, поэтому выход читается как истончение, а не как выключение.
    // Блёстки не выводятся поверх текста и знака: искры должны жить в воздухе,
    // а не на буквах.
    drawAmberAtmosphere(ctx, phase.local, (data.motion ?? 1) * cue.visible * cue.light, phase.cycle, [
      { x: 400, y: 80, w: 1120, h: 280 },
      { x: 320, y: MARK_CENTER_Y - 190, w: 1280, h: 370 },
    ]);

    const displayFont = fontName(cfg.typography?.font || "cormorant-garamond");
    const gold = "#e9ca91", warm = "#d2ac70";

    // ── Заголовок, подзаголовок, разделитель: та же вертикаль, что у «Спонсоров».
    const heading = String(data.title ?? partnerDefaults().title).toLocaleUpperCase("ru-RU");
    const foil = ctx.createLinearGradient(0, 160 - 48, 0, 160 + 48);
    foil.addColorStop(0, "#fff9ea");
    foil.addColorStop(.28, "#f7e3b7");
    foil.addColorStop(.52, "#eed4a3");
    foil.addColorStop(.74, "#d5ae74");
    foil.addColorStop(.9, "#b98f56");
    foil.addColorStop(1, "#e6cd9c");
    // Безопасная зона текста считается по ширине занавеса: ткань лежит поверх
    // кадра, и подойти к ней вплотную нельзя. Кегль подбирается так, чтобы
    // строка гарантированно оставалась правее ткани, а не «на глаз».
    // Кромка ткани диагональная, поэтому граница берётся для строки каждой
    // надписи: на высоте заголовка штора шире «средней» доли, и общая граница
    // пропускала первую букву под ткань при широкой шторе.
    const safe = textSafeLeft(data, { atY: 158 - 37 });
    if (cue.title > 0.003) {
      ctx.save();
      ctx.globalAlpha = cue.visible * cue.title;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // Кегль 74 px вместо 96: заголовок стал легче и наконец расходится
      // с подзаголовком по весу — раньше они спорили.
      const font = fitFontSize({
        size: 74, min: 40,
        measure: (size) => {
          ctx.font = `600 ${size}px "${displayFont}", serif`;
          return ctx.measureText(heading).width;
        },
      }, safe);
      ctx.font = `600 ${font.size}px "${displayFont}", serif`;
      ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      ctx.fillStyle = foil;
      // Вход: строка приходит снизу и из лёгкого разгона, а не «выцветает».
      const rise = 26 * (1 - cue.title) + 6 * (1 - cue.subtitle);
      ctx.fillText(heading, w / 2, 158 + rise);
      ctx.restore();
    }
    if (cue.subtitle > 0.003) {
      const text = String(data.subtitle ?? partnerDefaults().subtitle);
      ctx.save();
      ctx.globalAlpha = cue.visible * cue.subtitle;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const font = fitFontSize({
        size: 44, min: 28,
        measure: (size) => {
          ctx.font = `400 ${size}px "${displayFont}", serif`;
          return ctx.measureText(text).width;
        },
      }, textSafeLeft(data, { atY: 258 - 22 }));
      ctx.font = `400 ${font.size}px "${displayFont}", serif`;
      ctx.fillStyle = gold;
      ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
      ctx.fillText(text, w / 2, 258 + 18 * (1 - cue.subtitle));
      ctx.restore();
    }
    // Разделитель растёт от центра: сначала линия, потом ромб.
    if (cue.rule > 0.004) {
      // Ширина линии тоже упирается в безопасную зону: кончик не должен
      // уходить в ткань даже на самом широком кадре.
      const width = Math.min(300, Math.max(120, 960 - textSafeLeft(data, { atY: 318 }) - 40)) * cue.rule;
      ctx.save();
      ctx.globalAlpha = cue.title * cue.visible;
      ctx.strokeStyle = warm; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 - width, 318); ctx.lineTo(w / 2 - 16, 318);
      ctx.moveTo(w / 2 + 16, 318); ctx.lineTo(w / 2 + width, 318);
      ctx.stroke();
      ctx.translate(w / 2, 318); ctx.rotate(Math.PI / 4);
      const size = 4 * (0.55 + 0.45 * cue.rule);
      ctx.globalAlpha = cue.title * cue.visible * cue.rule;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
    }

    // ── Крупный знак спонсора по центру.
    const logo = this._markFor();
    if (logo) {
      const box = markBox(logo.width, logo.height, markScaleFor(cfg));
      const p = easeOutBack(cue.mark);
      const rise = (1 - Math.min(1, p)) * 34;
      const breathe = cue.idle * 0.006 * Math.sin(phase.local * 0.55);
      const floatY = cue.idle * 3.2 * Math.sin(phase.local * 0.44);
      const grow = 0.94 + 0.06 * Math.min(1, p) + breathe;
      const cx = w / 2, cy = MARK_CENTER_Y + rise + floatY;
      const lw = box.width, lh = box.height;

      // Тёплая «подушка» под знаком: отделяет золото от винного фона.
      if (cue.shadow > 0.01) {
        ctx.save();
        ctx.globalAlpha = cue.visible * Math.min(1, cue.mark) * cue.shadow * 0.42;
        ctx.translate(cx, cy + lh * 0.6);
        ctx.scale(1, 0.24);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, lw * 0.62);
        glow.addColorStop(0, "rgba(255,196,120,.20)");
        glow.addColorStop(.55, "rgba(232,138,72,.08)");
        glow.addColorStop(1, "rgba(200,100,50,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, lw * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = cue.visible * Math.max(0, Math.min(1, cue.mark * 1.2));
      ctx.translate(cx, cy);
      ctx.scale(grow, grow);
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      // Блик идёт по самому знаку: тот же drawMarkGlint, что в «Спонсорах»,
      // поэтому золото блестит одинаково во всей программе.
      const sweep = glintSpan(phase.local, { start: markGlintAt(cfg), span: 0.85, from: -0.4, to: 1.4 });
      drawMarkGlint(ctx, logo, -lw / 2, -lh / 2, lw, lh, sweep,
        cue.visible * Math.min(1, cue.glint) * 0.95);
      // Второй, медленный проход на удержании: дорогой акцент, не мигание.
      drawMarkGlint(ctx, logo, -lw / 2, -lh / 2, lw, lh,
        glintSpan(phase.local, { start: markGlintAt(cfg) + 3.6, span: 1.6, from: -0.35, to: 1.35 }),
        cue.visible * cue.idle * 0.5);
      ctx.restore();
    }

    // Рамка и занавес — в том же порядке, что у «Спонсоров»: занавес поверх.
    drawPartnersDecor(ctx, { ...cue, local: phase.local }, {
      ...partnerDefaults(), ...data, frameVisible: data.frameVisible !== false,
    }, assets.curtain);

    this.cardTexture.needsUpdate = true;
  }

  /**
   * Знак для этой заставки: выбранный в настройках спонсор, свой файл или
   * встроенный золотой знак. Кэшируется по ключу, поэтому в кадре нет ни
   * подготовки логотипа, ни чтения пикселей.
   */
  _markFor() {

    const data = this.cfg?.sponsor ?? {};
    const key = `${data.mark ?? "keaz"}|${data.markLogo ? data.markLogo.length : 0}|${data.logoStyle ?? "gold"}`;
    if (key === this._markKey && this._mark) return this._mark;
    const mark = partnersMark(MARK_KEYS[data.mark] ?? "partner2", data.markLogo, data.logoStyle);
    // Отрицательный результат не кэшируем: знаки готовятся вместе с фоном, и
    // первый кадр вполне может пройти до загрузки. Иначе «пока нет» останется
    // навсегда и заставка выйдет пустой.
    if (!mark) return null;
    this._markKey = key;
    this._mark = mark;
    return mark;
  }

  render() {
    this.renderer.setRenderTarget(null);
    if (this._blackFrame) this.renderer.clear(true, true, true);
    else this.renderer.render(this.cardScene, this.cardCamera);
  }

  dispose() {
    this._textures.forEach((texture) => texture.dispose());
    this.cardMesh.geometry.dispose();
    this.cardMesh.material.dispose();
    this.renderer.dispose();
  }
}
