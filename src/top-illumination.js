import { upperRaysCue } from './scenes/cues.js';

/** Положение штатного ореола и связанного с ним источника освещения металла. */
export function updateTopIllumination(light, glow, cfg, reveal, exposure) {
  const settings = cfg.topIllumination;
  light.position.set(settings.offsetX, settings.offsetY + 0.9, -0.8);
  glow.position.set(settings.offsetX, settings.offsetY, -0.6);
  glow.scale.setScalar(9 * settings.scale);
  light.color.set(settings.lightColor);
  glow.material.color.set(settings.color);
  light.visible = glow.visible = settings.enabled !== false;
  light.intensity = cfg.lights.topGlow * reveal * exposure;
  glow.material.opacity = Math.min(1, 0.6 * reveal * cfg.lights.topGlow / 40);
}

/** Самостоятельный слой верхних лучей: настройки независимы от ореола. */
export function updateUpperRays(background, phase, cfg, intro, opening, time) {
  const top = cfg.topIllumination, u = background.uniforms;
  u.uIntroLight.value = top.raysEnabled !== false ? upperRaysCue(phase, cfg.timeline, intro, opening) * top.raysIntensity : 0;
  u.uCinematic.value = cfg.logo.cinematic === true ? 1 : 0;
  u.uUpperTime.value = time * top.raysSpeed;
  u.uUpperColor.value.set(top.raysColor);
}
