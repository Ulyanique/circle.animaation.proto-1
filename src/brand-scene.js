import { LogoScene } from "./scene.js";
import { BrandDecor } from "./brand-decor.js";
import { computePhase } from "./timeline.js";

/** №2: фирменная среда с долгим удержанием. */
export class BrandScene extends LogoScene {
  constructor(canvas, config, { contourWaves = false, decor = true } = {}) {
    // Конфиг сцены приходит целиком: панель настроек правит именно его.
    super(canvas, config, { intro: false, contourWaves });
    this.brandDecor = decor ? new BrandDecor() : null;
    if (this.brandDecor) this.scene.add(this.brandDecor.group);
  }

  update(t, dt) {
    super.update(t, dt);
    if (this.brandDecor) {
      // Новая окружность заменяет прежнюю центральную пунктирную разметку.
      this.corners.centerRing.visible = false;
      this.brandDecor.update(t, computePhase(t, this.cfg.timeline), this.cfg, this.logo.root);
    }
  }
}
