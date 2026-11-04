import * as THREE from "three";
import { loopLocal } from "./scenes/cues.js";

const smooth = (a, b, x) => {
  const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};

/** Три оттиска настоящего SVG-контура циркуля, а не обычные круглые ряби.
 * Один и тот же t всегда даёт тот же кадр: seek и покадровая запись не расходятся. */
export class ContourWaves {
  constructor(logo) {
    const { subPaths, cx, cy, K } = logo.parsed;
    this.geometry = subPaths.map((sp) => {
      const points = sp.getSpacedPoints(Math.min(160, Math.max(32, Math.ceil(sp.getLength() * K * 22))));
      const geo = new THREE.BufferGeometry();
      geo.setFromPoints(points.map((p) => new THREE.Vector3((p.x - cx) * K, -(p.y - cy) * K, 0)));
      return geo;
    });
    this.group = new THREE.Group();
    this.pulses = Array.from({ length: 3 }, () => {
      const group = new THREE.Group();
      const material = new THREE.LineBasicMaterial({
        color: 0xe6b86b, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      this.geometry.forEach((geo) => {
        const path = new THREE.Line(geo, material);
        path.frustumCulled = false;
        group.add(path);
      });
      group.position.z = -0.35;
      this.group.add(group);
      return { group, material };
    });
  }

  update(t, cycle, x, y, baseScale, reveal, strength = 1) {
    const local = loopLocal(t, cycle);
    this.group.position.set(x, y, 0);
    // Пульсы идут последовательно, проявляясь за главным знаком, затем
    // рассеиваются в тумане. На входе/выходе их гасит envelope reveal.
    this.pulses.forEach(({ group, material }, i) => {
      const p = ((local + i * 1.8) % 5.4) / 5.4;
      const opacity = 0.20 * strength * reveal * smooth(0, 0.16, p) * (1 - smooth(0.42, 1, p));
      material.opacity = opacity;
      group.visible = opacity > 0.0005;
      group.scale.setScalar(baseScale * (1 + p * 0.86));
      group.rotation.y = 0.18 * Math.sin(p * Math.PI);
    });
  }

  dispose() {
    this.geometry.forEach((geo) => geo.dispose());
    this.pulses.forEach(({ material }) => material.dispose());
  }
}
