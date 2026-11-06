import { LogoScene } from "./scene.js";
import { cloneDefaults, deepMerge } from "./config.js";
import { WAITING_DEFAULTS } from "./scenes/waiting.js";
import { sceneRenderTimeline } from "./scenes/defaults.js";
import { fieldCues, quietBreath } from "./scenes/cues.js";
import { computePhase } from "./timeline.js";
import { glyphReveal } from "./caption.js";
import { ContourWaves } from "./contour-waves.js";
import { DecorLayer } from "./decor-layer.js";

/** Внутренний конфиг полевых сцен: визуальные секции берутся из настроек
 * активной сцены, а художественные фазы и удержание считаются от внешнего цикла.
 * @param {any} config
 */
function renderConfig(config) {
  const cfg = cloneDefaults(WAITING_DEFAULTS);
  const visual = { ...config };
  delete visual.timeline;
  delete visual.playback;
  deepMerge(cfg, visual);
  cfg.timeline = sceneRenderTimeline(config.timeline.holdDuration, config.timeline.speed ?? 1);
  return cfg;
}

/** №2: движение фона не останавливается на удержании, а SVG-контур циркуля
 * расходится за знаком негромкими волнами. Все состояния — функция времени. */
export class BrandScene extends LogoScene {
  /** @param {HTMLCanvasElement} canvas @param {any} config */
  constructor(canvas, config) {
    super(canvas, renderConfig(config));
    this.brandConfig = config;
    this.waves = new ContourWaves(this.logo);
    this.scene.add(this.waves.group);
    this.decor = new DecorLayer(config.decor);
    this.scene.add(this.decor.group);
  }

  /** Настройки одной сцены могут измениться из панели без пересоздания WebGL. */
  setExternalConfig(config) {
    this.brandConfig = config;
    this.syncConfig();
  }

  /** @param {number} _t @param {number} _dt */
  syncConfig(_t, _dt) {
    const external = this.brandConfig;
    const visual = { ...external };
    delete visual.timeline;
    delete visual.playback;
    deepMerge(this.cfg, visual);
    this.cfg.timeline = sceneRenderTimeline(external.timeline.holdDuration, external.timeline.speed ?? 1);
  }

  update(t, dt) {
    this.syncConfig();
    super.update(t, dt);
    const cycle = this.brandConfig.timeline.holdDuration;
    const ph = computePhase(t, this.cfg.timeline);
    const breathe = quietBreath(t, cycle);
    const reveal = ph.reveal * ph.rings;
    const L = this.cfg.layout;
    // Циркуль читается как 3D-металл, но не переворачивается зеркально.
    this.logo.root.position.x = L.logoX;
    // Полевые сцены держат знак на фиксированной оси из layout.logoY; sway
    // остаётся в повороте, но не должен уводить логотип по высоте.
    this.logo.root.position.y = L.logoY;
    this.logo.root.scale.multiplyScalar(L.logoScale * (1 + 0.012 * breathe));
    this.logo.root.rotation.y += L.logoRotation * breathe;
    // super.update уже оживляет каустику, лучи, пыль, риски и блики.
    this.background.uniforms.uEnvL.value = L.envL * L.bgL * ph.rings;
    this.background.uniforms.uEnvR.value = L.envR * L.bgR * ph.rings;
    this.topGlow.position.set(0, L.topGlowY, -0.65);
    this.topGlow.scale.setScalar(L.topGlowScale);
    this.topGlow.material.opacity *= L.topGlowOpacity;
    this.waves.update(t, cycle, 0, L.waveY, this.logo.root.scale.x, reveal);
    this.waves.pulses.forEach(({ group, material }) => {
      group.scale.multiplyScalar(L.waveScale);
      material.opacity *= L.waveOpacity;
    });
    // Фазовый декор №2 гаснет вместе с общей огибающей колец: шов остаётся тёмным.
    this.decor.update(t, this.cfg, cycle, ph.rings);
    const cue = fieldCues(t, cycle);
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72);
  }

  /** Общая для №2/8/9 посимвольная маска: DOM и экспортный canvas читают
   * одинаковые --p/--f; на выходе заливка возвращается к контуру.
   * @param {string} selector @param {number} outline @param {number} fill
   * @param {number} lift @param {number} [erase]
   */
  _letterLine(selector, outline, fill, lift, erase = 0) {
    const line = document.querySelector(selector);
    if (!line) return;
    const k = Math.max(0, Math.min(1, erase));
    const visible = 1 - k;
    const p = outline * visible;
    const f = fill * visible;
    const u = parseFloat(document.getElementById("caption")?.style.getPropertyValue("--u")) || 19.2;
    line.style.setProperty("--p", p.toFixed(4));
    line.style.setProperty("--f", f.toFixed(4));
    line.style.setProperty("--erase", k.toFixed(4));
    line.style.setProperty("--lift", `${((1 - p) ** 2 * lift * u).toFixed(3)}px`);
    const pen = 0.24 * Math.sin(Math.PI * p);
    line.style.setProperty("--pen", pen.toFixed(4));
    const glyphs = line.children;
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphReveal({ outline: p, fill: f }, i, glyphs.length);
      glyphs[i].style.setProperty("--o", glyph.outline.toFixed(4));
      glyphs[i].style.setProperty("--f", glyph.fill.toFixed(4));
      glyphs[i].style.setProperty("--gpen", (pen * Math.sin(Math.PI * glyph.outline)).toFixed(4));
    }
  }

  dispose() {
    this.decor?.dispose();
    super.dispose();
  }
}
