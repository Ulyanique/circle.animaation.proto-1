import * as THREE from 'three';
import { brandDecorLayout } from './scenes/brand-decor-layout.js';

/** Тонкая построительная окружность и орбитальные отметки для сцены 02. */
export class BrandDecor {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'brand-decor';
    const ringPoints = [];
    for (let i = 0; i < 256; i++) {
      const a = i / 256 * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const material = () => new THREE.LineBasicMaterial({
      color: 0xe0b25a, transparent: true, opacity: 0, depthWrite: false,
    });
    this.ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints), material());
    const layout = brandDecorLayout();
    const ticksGeometry = new THREE.BufferGeometry();
    ticksGeometry.setAttribute('position', new THREE.BufferAttribute(layout.ticks, 3));
    this.ticks = new THREE.LineSegments(ticksGeometry, material());
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(layout.dust, 3));
    this.dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
      color: 0xe0b25a, size: 0.018, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.group.add(this.ring, this.ticks, this.dust);
  }

  update(time, phase, config, root) {
    const d = config.decor;
    const visibility = phase.beforeStart ? 0 : phase.reveal * phase.rings;
    this.group.visible = d.enabled && visibility > 0.001;
    if (!this.group.visible) return;
    this.group.position.set(root.position.x, root.position.y, -0.25);
    this.group.scale.setScalar(d.radius);
    this.ticks.rotation.z = time * d.speed;
    this.dust.rotation.z = -time * d.speed * 0.65;
    this.ring.material.color.set(d.color);
    this.ticks.material.color.set(d.color);
    this.dust.material.color.set(d.color);
    this.ring.material.opacity = d.opacity * visibility;
    this.ticks.material.opacity = d.opacity * visibility;
    this.dust.material.opacity = d.dustOpacity * visibility;
    this.dust.material.size = d.dustSize;
  }
}
