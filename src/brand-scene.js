import { LogoScene } from "./scene.js";
import { cloneDefaults } from "./config.js";
import { WAITING_DEFAULTS } from "./scenes/waiting.js";
import { FIELD_TIMING, fieldCues, quietBreath } from "./scenes/cues.js";
import { computePhase } from "./timeline.js";
import { glyphReveal } from "./caption.js";
import { ContourWaves } from "./contour-waves.js";

// Виды №2/8/9 наследуют язык №1: дуги, последовательную прорисовку
// циркуля, световой проход, пыль и обратную разборку. Только интенсивность
// фона приглушена — титры и выступающий на сцене человек остаются главными.
function renderConfig(cycle) {
  const cfg = cloneDefaults(WAITING_DEFAULTS);
  cfg.timeline = {
    ...cfg.timeline, ...FIELD_TIMING, startDelay: 0,
    holdDuration: Math.max(0.2, cycle - FIELD_TIMING.drawDuration -
      FIELD_TIMING.emergeDuration - FIELD_TIMING.fadeDuration - FIELD_TIMING.restDuration),
  };
  cfg.rings.layers = 2;
  cfg.rings.glowIntensity = 0.85;
  cfg.rings.lightStrength = 1.3;
  cfg.rings.constructionOpacity = 0.18;
  cfg.rings.flicker = 0;
  cfg.particles.count = 380;
  cfg.particles.dust = 170;
  cfg.particles.brightness = 0.65;
  cfg.sparks.count = 70;
  cfg.sparks.intensity = 0.48;
  cfg.background.lightIntensity = 0.55;
  cfg.background.fog = 0.46;
  cfg.background.godRays = 0.25;
  cfg.background.gridOpacity = 0.012;
  cfg.background.shimmer = 0.38;
  cfg.lights.topGlow = 7;
  return cfg;
}

/** №2: движение фона не останавливается на удержании, а SVG-контур циркуля
 * расходится за знаком негромкими волнами. Все состояния — функция времени. */
export class BrandScene extends LogoScene {
  constructor(canvas, config) {
    super(canvas, renderConfig(config.timeline.holdDuration));
    this.brandConfig = config;
    this.waves = new ContourWaves(this.logo);
    this.scene.add(this.waves.group);
  }

  update(t, dt) {
    const cycle = this.brandConfig.timeline.holdDuration;
    // Пульт изменяет длительность внешнего цикла: художественные фазы остаются
    // фиксированными, растягивается только удержание (без дрейфа стыка).
    this.cfg.timeline.holdDuration = Math.max(0.2, cycle - FIELD_TIMING.drawDuration -
      FIELD_TIMING.emergeDuration - FIELD_TIMING.fadeDuration - FIELD_TIMING.restDuration);
    super.update(t, dt);
    const ph = computePhase(t, this.cfg.timeline);
    const breathe = quietBreath(t, cycle);
    const reveal = ph.reveal * ph.rings;
    // Циркуль по оси над подписью. Небольшая пространственная прецессия
    // читается как 3D-металл, но никогда не переворачивает символ зеркально.
    this.logo.root.position.set(0, 1.00, this.logo.root.position.z);
    this.logo.root.scale.multiplyScalar(1.085 * (1 + 0.012 * breathe));
    this.logo.root.rotation.y += 0.075 * breathe;
    // super.update(t) уже оживляет каустику, лучи, пыль, риски и блики;
    // угловое освещение постепенно уходит в ноль вместе с кольцами.
    this.background.uniforms.uEnvL.value = 0.48 * ph.rings;
    this.background.uniforms.uEnvR.value = 0.43 * ph.rings;
    this.topGlow.position.set(0, 1.05, -0.65);
    this.topGlow.scale.setScalar(5.5);
    this.topGlow.material.opacity *= 0.8;
    this.waves.update(t, cycle, 0, 1.00, this.logo.root.scale.x, reveal);
    const cue = fieldCues(t, cycle);
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72);
  }

  /** Общая для №2/8/9 посимвольная маска: DOM и экспортный canvas читают
   * одинаковые --p/--f; на выходе заливка возвращается к контуру. */
  _letterLine(selector, outline, fill, lift) {
    const line = document.querySelector(selector);
    if (!line) return;
    const u = parseFloat(document.getElementById("caption")?.style.getPropertyValue("--u")) || 19.2;
    line.style.setProperty("--p", outline.toFixed(4));
    line.style.setProperty("--f", fill.toFixed(4));
    line.style.setProperty("--lift", `${((1 - outline) ** 2 * lift * u).toFixed(3)}px`);
    const pen = 0.24 * Math.sin(Math.PI * outline);
    line.style.setProperty("--pen", pen.toFixed(4));
    const glyphs = line.children;
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphReveal({ outline, fill }, i, glyphs.length);
      glyphs[i].style.setProperty("--o", glyph.outline.toFixed(4));
      glyphs[i].style.setProperty("--f", glyph.fill.toFixed(4));
      glyphs[i].style.setProperty("--gpen", (pen * Math.sin(Math.PI * glyph.outline)).toFixed(4));
    }
  }
}
