import * as THREE from 'three';

/** Детерминированное облако: генерация не зависит от времени или предыдущих кадров. */
export function cloudPositions(count) {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(2000, Math.round(count))) : 0;
  const points = new Float32Array(n * 3);
  let seed = 0x42a19f21;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random());
    points[3 * i] = Math.cos(angle) * radius;
    points[3 * i + 1] = Math.sin(angle) * radius;
    points[3 * i + 2] = (random() - 0.5) * 0.24;
  }
  return points;
}

/** Мягкая круглая точка, без загрузки внешних изображений. */
function particleTexture() {
  const size = 32, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - size / 2) / (size / 2), dy = (y + 0.5 - size / 2) / (size / 2);
    const opacity = Math.max(0, 1 - Math.hypot(dx, dy));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(opacity * opacity * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Один переносимый эффект в каждой сцене; WebGL-кадр и экспорт используют один объект. */
export class ParticleCloud {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'particle-cloud';
    this.geometry = new THREE.BufferGeometry();
    this.texture = particleTexture();
    this.material = new THREE.PointsMaterial({ color: 0xe8c77e, map: this.texture, size: 0.035, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.points = new THREE.Points(this.geometry, this.material);
    this.group.add(this.points);
    this.count = -1;
  }
  update(time, phase, cfg) {
    const p = cfg.particleCloud;
    const visibility = phase.beforeStart ? 0 : phase.reveal * phase.rings;
    this.group.visible = p?.present === true && p.enabled !== false && visibility > 0.001;
    if (!this.group.visible) return;
    const count = Number.isFinite(p.count) ? Math.max(0, Math.min(2000, Math.round(p.count))) : 0;
    if (count !== this.count) {
      this.count = count;
      const oldGeometry = this.geometry;
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions(count), 3));
      this.geometry.computeBoundingSphere();
      this.points.geometry = this.geometry; oldGeometry.dispose();
    }
    this.group.position.set(p.offsetX, p.offsetY, -0.25);
    this.group.scale.setScalar(p.radius);
    this.group.rotation.z = time * p.speed;
    this.material.color.set(p.color);
    this.material.opacity = p.opacity * visibility;
    this.material.size = p.size;
  }
  // Геометрию и материал освобождает общий обход сцены; текстура учитывается отдельно.
  dispose() { this.texture.dispose(); }
}
