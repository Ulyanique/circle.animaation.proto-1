import { BrandScene } from "./brand-scene.js";

/** №9: вход и отдельная последовательность ухода заданы конфигом finale. */
export class FinaleScene extends BrandScene {
  constructor(canvas, config) {
    super(canvas, config, { decor: false, introStyle: true });
  }
}
