import { LogoScene } from "./scene.js";

/** №2: фирменная среда с долгим удержанием. */
export class BrandScene extends LogoScene {
  constructor(canvas, config, { contourWaves = false } = {}) {
    // Конфиг сцены приходит целиком: панель настроек правит именно его.
    super(canvas, config, { intro: false, contourWaves });
  }
}
