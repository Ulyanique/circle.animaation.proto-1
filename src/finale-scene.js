import { BrandScene } from "./brand-scene.js";
import { finaleCues } from "./scenes/cues.js";
import { glyphReveal } from "./caption.js";

/** №9: знак, название и финальная фраза собираются по буквам и уходят в тишину. */
export class FinaleScene extends BrandScene {
  update(t, dt) {
    super.update(t, dt);
    const cue = finaleCues(t, this.brandConfig.timeline.holdDuration);
    this.logo.root.position.set(0, 1.02, 0);
    this.logo.root.scale.setScalar(0.50 * cue.symbol);
    this.logo.root.rotation.set(0, 0, 0);
    this.background.uniforms.uEnvL.value = 0.08 * cue.light;
    this.background.uniforms.uEnvR.value = 0.08 * cue.light;
    this.topGlow.position.set(0, 1.35, -0.65);
    this.topGlow.material.opacity = 0.085 * cue.light;

    // ВебGL-заслонка закрывает шум и золото на шве; DOM-текст закрывается
    // своими посимвольными масками, как и при экспорте canvas/WebM.
    this.seamCurtain.material.opacity = 1 - cue.symbol;
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72);
    this._letterLine(".cap-sub", cue.phraseOutline, cue.phraseFill, 0.48);
  }

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
