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
  /** @param {HTMLCanvasElement} canvas @param {any} config */
  constructor(canvas, config) {
    super(canvas, config);
    this.viewfinder = makeViewfinder();
    this.scene.add(this.viewfinder);
  }

  update(t, dt) {
    super.update(t, dt);
    const L = this.cfg.layout;
    const breathe = quietBreath(t, this.brandConfig.timeline.holdDuration);
    // Ось и масштаб логотипа задаются конфигом сцены; видоискатель следует за ним.
    this.logo.root.position.x = L.logoX;
    this.viewfinder.position.set(0, L.viewfinderY, -0.22);
    this.viewfinder.scale.setScalar(L.viewfinderScale * (1 + 0.008 * breathe));
    // uEnvL уже включает bgL; берём то же основание, чтобы прозрачность
    // уголков совпадала с исходной сценой, где множитель применялся после неё.
    const envL = Math.max(0.0001, L.envL * L.bgL);
    this.viewfinder.material.opacity = L.viewfinderOpacity *
      Math.min(1, this.logo.root.scale.x / 0.5) *
      Math.min(1, this.background.uniforms.uEnvL.value / envL);
  }

  dispose() {
    this.viewfinder.geometry.dispose();
    this.viewfinder.material.dispose();
    super.dispose();
  }
}
