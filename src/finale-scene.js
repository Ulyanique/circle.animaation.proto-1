import { BrandScene } from "./brand-scene.js";
import { finaleCues } from "./scenes/cues.js";

/** №9: та же прорисовка циркуля и живое золотое поле, но дополнительно
 * «История продолжается». Уход — в обратном порядке: фраза, название,
 * металл, контур и крайние кольца; темнота прячет шов цикла. */
export class FinaleScene extends BrandScene {
  update(t, dt) {
    super.update(t, dt);
    const cue = finaleCues(t, this.brandConfig.timeline.holdDuration);
    const L = this.cfg.layout;
    this.logo.root.position.x = L.logoX;
    this.logo.root.scale.multiplyScalar(cue.symbol);
    // Множители фона, верхнего свечения и волн уже пришли из layout в BrandScene;
    // здесь поверх них работает только общая огибающая финального ухода.
    this.background.uniforms.uEnvL.value *= cue.light;
    this.background.uniforms.uEnvR.value *= cue.light;
    this.topGlow.material.opacity *= cue.light;
    this.waves.pulses.forEach(({ material }) => { material.opacity *= cue.light; });
    this.seamCurtain.material.opacity = Math.max(this.seamCurtain.material.opacity, 1 - cue.symbol);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72);
    this._letterLine(".cap-sub", cue.phraseOutline, cue.phraseFill, 0.48);
  }
}
