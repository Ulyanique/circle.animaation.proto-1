import { BrandScene } from "./brand-scene.js";
import { finaleCues } from "./scenes/cues.js";

/** №9: та же прорисовка циркуля и живое золотое поле, но дополнительно
 * «История продолжается». Уход — в обратном порядке: фраза, название,
 * металл, контур и крайние кольца; темнота прячет шов цикла. */
export class FinaleScene extends BrandScene {
  update(t, dt) {
    super.update(t, dt);
    const cue = finaleCues(t, this.brandConfig.timeline.holdDuration);
    this.logo.root.position.y = 1.00;
    this.logo.root.scale.multiplyScalar(cue.symbol);
    // Не обнуляем живой поворот и туман от BrandScene — у финала тот же
    // световой язык, только другие тайминги и собственная фраза.
    this.background.uniforms.uEnvL.value *= 0.94 * cue.light;
    this.background.uniforms.uEnvR.value *= 0.93 * cue.light;
    this.topGlow.material.opacity *= cue.light;
    // В финале название ближе к циркулю: силуэты волн меньше, чтобы
    // графические штрихи никогда не пересекали строку титра.
    this.waves.pulses.forEach(({ group, material }) => {
      group.scale.multiplyScalar(0.72);
      material.opacity *= 0.68 * cue.light;
    });
    this.seamCurtain.material.opacity = Math.max(this.seamCurtain.material.opacity, 1 - cue.symbol);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72);
    this._letterLine(".cap-sub", cue.phraseOutline, cue.phraseFill, 0.48);
  }
}
