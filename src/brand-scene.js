import { LogoScene } from "./scene.js";
import { cloneDefaults } from "./config.js";
import { WAITING_DEFAULTS } from "./scenes/waiting.js";

// Переиспользуем проверенный Three.js/PMREM/postprocessing рендерер, но не
// тайминг и декор заставки ожидания. Все движения нового вида — функция t.
function renderConfig() {
  const cfg = cloneDefaults(WAITING_DEFAULTS);
  cfg.rings.enabled = false;
  cfg.particles.enabled = false;
  cfg.particles.count = 0;
  cfg.particles.dust = 0;
  cfg.sparks.enabled = false;
  cfg.sparks.count = 0;
  cfg.background.lightIntensity = 0.24;
  cfg.background.fog = 0.24;
  cfg.background.godRays = 0.06;
  cfg.background.gridOpacity = 0;
  cfg.background.shimmer = 0.12;
  cfg.lights.topGlow = 6;
  return cfg;
}

const smooth = (a, b, x) => {
  const p = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return p * p * (3 - 2 * p);
};

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
    const local = ((t % cycle) + cycle) % cycle;
    // Покой по обе стороны шва — реальные первый и последний кадры идентичны.
    const settle = smooth(0.25, 1.5, local) *
      (1 - smooth(cycle - 1.5, cycle - 0.25, local));
    const breathe = Math.sin(local * Math.PI * 2 / cycle) * settle;
    this.logo.root.position.set(-1.7, 0.06, 0);
    this.logo.root.scale.setScalar(0.61 * (1 + 0.012 * breathe));
    this.logo.root.rotation.set(0.015 * breathe, 0.022 * breathe, 0);
    // Световая подложка поддерживает символ, а не делает из углов два солнца.
    this.background.uniforms.uEnvL.value = 0.13;
    this.background.uniforms.uEnvR.value = 0.08;
    this.topGlow.position.set(-1.7, 0.15, -0.65);
    this.topGlow.scale.setScalar(5.5);
    this.topGlow.material.opacity = 0.10 + 0.012 * breathe;
    this.corners.group.visible = false;
    this.plotter.group.visible = false;
    this.particles.group.visible = false;
    this.solarBokeh.group.visible = false;
    this.flare.mesh.visible = false;
  }
}
