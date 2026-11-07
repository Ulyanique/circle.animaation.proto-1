import { LogoScene } from "./scene.js";
import { CircularLabel } from "./circular-label.js";
import { computePhase } from "./timeline.js";
import { captionState } from "./caption.js";

/** Фоновая композиция; круговая надпись включена конфигом сцены. */
export class BrandScene extends LogoScene {
  constructor(canvas, config, { contourWaves = false, decor = true, photoSpin = false, introStyle = false } = {}) {
    super(canvas, config, { intro: false, contourWaves, photoSpin, introStyle });
    this.hideCenterRing = decor;
    this.circularText = config.photo ? new CircularLabel(this.scene, this.renderer) : null;
    this.circularLabel = this.circularText?.mesh;
  }
  refreshTextTexture() { this.circularText?.refreshTextTexture(); }
  update(t, dt) {
    super.update(t, dt);
    if (this.circularText && this.cfg.photo) {
      const phase = computePhase(t, this.cfg.timeline);
      this.circularText.update(this.cfg, phase, captionState(t, this.cfg.timeline).lines.title.outline, this.logo.root);
    }
  }
  dispose() { this.circularText?.dispose(); super.dispose(); }
}
