import { LogoScene } from "./scene.js";
import { createSharedSceneRenderConfig } from "./scenes/shared-visuals.js";

/** №2: фирменная среда с расходящимися контурами и долгим удержанием. */
export class BrandScene extends LogoScene {
  constructor(canvas, config) {
    super(canvas, createSharedSceneRenderConfig(config.timeline), { intro: false });
  }
}
