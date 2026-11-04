import * as THREE from "three";
import { BrandScene } from "./brand-scene.js";
import { quietBreath } from "./scenes/cues.js";

function makeViewfinder() {
  const corners = [];
  const x = 1.62, y = 1.32, length = 0.22;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    corners.push(sx * x, sy * y, 0, sx * (x - length), sy * y, 0);
    corners.push(sx * x, sy * y, 0, sx * x, sy * (y - length), 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xdab46f, transparent: true, opacity: 0.24,
    depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

/** №8: пауза для фотографий — ясный титр и тихая рамка видоискателя. */
export class PhotoPauseScene extends BrandScene {
  constructor(canvas, config) {
    super(canvas, config);
    this.viewfinder = makeViewfinder();
    this.scene.add(this.viewfinder);
  }

  update(t, dt) {
    super.update(t, dt);
    const breathe = quietBreath(t, this.brandConfig.timeline.holdDuration);
    // Те же ось и масштаб, что у №2: видоискатель обнимает символ,
    // а «Фотопауза» стоит строго под ним, не смещая всю композицию.
    this.logo.root.position.x = 0;
    this.logo.root.position.y = 1.00;
    this.viewfinder.position.set(0, 1.00, -0.22);
    this.viewfinder.scale.setScalar(1 + 0.008 * breathe);
    this.viewfinder.material.opacity = 0.24 * Math.min(1, this.logo.root.scale.x / 0.5) *
      Math.min(1, this.background.uniforms.uEnvL.value / 0.48);
    // Та же живая сцена, чуть мягче и симметричнее, чем у фирменного фона.
    this.background.uniforms.uEnvL.value *= 0.83;
    this.background.uniforms.uEnvR.value *= 0.91;
    this.waves.pulses.forEach(({ material }) => { material.opacity *= 0.72; });
    this.topGlow.position.set(0, 1.00, -0.65);
    this.topGlow.material.opacity *= 0.88;
  }

  dispose() {
    this.viewfinder.geometry.dispose();
    this.viewfinder.material.dispose();
    super.dispose();
  }
}
