import * as THREE from "three";
import { BrandScene } from "./brand-scene.js";
import { computePhase } from "./timeline.js";

function makeViewfinder() {
  const corners = [];
  const x = 1.5, y = 0.98, length = 0.19;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    corners.push(sx * x, sy * y, 0, sx * (x - length), sy * y, 0);
    corners.push(sx * x, sy * y, 0, sx * x, sy * (y - length), 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xdab46f, transparent: true, opacity: 0,
    depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

/** №8: тот же фирменный фон с аккуратной рамкой видоискателя вокруг знака. */
export class PhotoPauseScene extends BrandScene {
  constructor(canvas, config) {
    super(canvas, config);
    this.viewfinder = makeViewfinder();
    this.scene.add(this.viewfinder);
  }

  update(t, dt) {
    super.update(t, dt);
    const phase = computePhase(t, this.cfg.timeline);
    this.viewfinder.position.set(this.logo.root.position.x, this.logo.root.position.y, -0.25);
    this.viewfinder.material.opacity = 0.24 * phase.reveal * phase.rings;
    this.viewfinder.visible = this.viewfinder.material.opacity > 0.001;
  }

  dispose() {
    this.viewfinder.geometry.dispose();
    this.viewfinder.material.dispose();
    super.dispose();
  }
}
