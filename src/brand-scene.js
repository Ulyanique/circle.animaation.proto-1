import { LogoScene } from "./scene.js";

/** Фоновая композиция; окружность теперь доступна во всех сценах. */
export class BrandScene extends LogoScene {
  constructor(canvas, config, { contourWaves = false, decor = true } = {}) {
    super(canvas, config, { intro: false, contourWaves });
    // Сохранить прежнюю разметку фоновых сцен: только у 02 она заменена декором.
    this.hideCenterRing = decor;
  }
}
