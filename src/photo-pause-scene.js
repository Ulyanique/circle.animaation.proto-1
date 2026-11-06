import * as THREE from "three";
import { BrandScene } from "./brand-scene.js";
import { quietBreath } from "./scenes/cues.js";
import { computePhase } from "./timeline.js";
import { PhotoPauseDecor } from "./photo-pause-decor.js";

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

/** №8: логотип строго в центре, уголки по краям экрана и круговая строка.
 * Маленькая рамка видоискателя остаётся скрытой настройкой для обратной совместимости. */
export class PhotoPauseScene extends BrandScene {
  /** @param {HTMLCanvasElement} canvas @param {any} config */
  constructor(canvas, config) {
    super(canvas, config);
    this.viewfinder = makeViewfinder();
    this.scene.add(this.viewfinder);
    this.photoDecor = new PhotoPauseDecor(config.photoPause);
    this.scene.add(this.photoDecor.group);
  }

  update(t, dt) {
    super.update(t, dt);
    const L = this.cfg.layout;
    const cycle = this.brandConfig.timeline.holdDuration;
    const ph = computePhase(t, this.cfg.timeline);
    const breathe = quietBreath(t, cycle);
    this.logo.root.position.x = L.logoX;
    this.viewfinder.position.set(0, L.viewfinderY, -0.22);
    this.viewfinder.scale.setScalar(L.viewfinderScale * (1 + 0.008 * breathe));
    this.viewfinder.visible = L.viewfinderOpacity > 0.001;
    // uEnvL уже включает bgL; берём то же основание, чтобы прозрачность
    // уголков совпадала с исходной сценой, где множитель применялся после неё.
    const envL = Math.max(0.0001, L.envL * L.bgL);
    this.viewfinder.material.opacity = L.viewfinderOpacity *
      Math.min(1, this.logo.root.scale.x / 0.5) *
      Math.min(1, this.background.uniforms.uEnvL.value / envL);
    this.photoDecor.update(t, this.cfg, cycle, ph.rings, this.halfW, this.halfH);
  }

  dispose() {
    this.viewfinder.geometry.dispose();
    this.viewfinder.material.dispose();
    this.photoDecor.dispose();
    super.dispose();
  }
}
