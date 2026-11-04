import { LogoScene } from "./scene.js";
import { cloneDefaults } from "./config.js";
import { WAITING_DEFAULTS } from "./scenes/waiting.js";
import { quietBreath } from "./scenes/cues.js";

// Переиспользуем проверенный Three.js/PMREM/postprocessing рендерер, но не
// тайминг и декор заставки ожидания. Все движения нового вида — функция t.
function renderConfig() {
  const cfg = cloneDefaults(WAITING_DEFAULTS);
  // Тот же световой язык, что у №1: золотые крайние кольца, туман,
  // каустика и пыль. Приглушённее исходной заставки, чтобы фон не спорил
  // с речью/титром, но больше не превращался в пустую чёрную плоскость.
  cfg.rings.enabled = true;
  cfg.rings.layers = 2;
  cfg.rings.glowIntensity = 0.85;
  cfg.rings.lightStrength = 1.3;
  cfg.rings.constructionOpacity = 0.18;
  cfg.rings.flicker = 0;
  cfg.particles.enabled = true;
  cfg.particles.count = 380;
  cfg.particles.dust = 170;
  cfg.particles.brightness = 0.65;
  cfg.sparks.enabled = false;
  cfg.sparks.count = 0;
  cfg.background.lightIntensity = 0.55;
  cfg.background.fog = 0.46;
  cfg.background.godRays = 0.25;
  cfg.background.gridOpacity = 0.012;
  cfg.background.shimmer = 0.38;
  cfg.lights.topGlow = 7;
  return cfg;
}

/** Второй вид: спокойное живое фирменное поле, без бегущих титров и искр. */
export class BrandScene extends LogoScene {
  constructor(canvas, config) {
    super(canvas, renderConfig());
    this.brandConfig = config;
    const tl = this.cfg.timeline;
    this.holdAt = tl.startDelay + tl.drawDuration + tl.emergeDuration + tl.holdDuration * 0.52;
  }

  update(t, dt) {
    // Состояние золота и окружения берём в полностью собранной фазе. Другая
    // заставка не может «протечь» сюда через общий цикл или прежний seek.
    super.update(this.holdAt, dt);
    const cycle = this.brandConfig.timeline.holdDuration;
    const breathe = quietBreath(t, cycle);
    // Единая композиция серии: циркуль по центру, подпись под ним.
    this.logo.root.position.set(0, 1.00, 0);
    this.logo.root.scale.setScalar(0.51 * (1 + 0.012 * breathe));
    this.logo.root.rotation.set(0.015 * breathe, 0.022 * breathe, 0);
    // Световая подложка поддерживает символ, а не делает из углов два солнца.
    this.background.uniforms.uTime.value = this.holdAt + 0.55 * breathe;
    this.background.uniforms.uEnvL.value = 0.48;
    this.background.uniforms.uEnvR.value = 0.43;
    this.corners.sides.left.ticks.rotation.z += 0.035 * breathe;
    this.corners.sides.right.ticks.rotation.z -= 0.035 * breathe;
    this.corners.centerRing.rotation.z += 0.02 * breathe;
    this.topGlow.position.set(0, 1.05, -0.65);
    this.topGlow.scale.setScalar(5.5);
    this.topGlow.material.opacity = 0.10 + 0.012 * breathe;
    this.corners.group.visible = true;
    this.plotter.group.visible = false;
    this.particles.group.visible = true;
    this.solarBokeh.group.visible = true;
    this.flare.mesh.visible = false;
  }
}
