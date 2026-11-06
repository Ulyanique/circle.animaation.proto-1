import * as THREE from 'three';

/** Самостоятельный световой ореол на фоне, без влияния на освещение металла. */
export class BackgroundGlow {
  constructor(texture) {
    this.group = new THREE.Group();
    this.group.name = 'background-glow';
    this.material = new THREE.SpriteMaterial({ map: texture, color: 0xffc879, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.sprite = new THREE.Sprite(this.material);
    this.group.add(this.sprite);
  }
  update(time, phase, cfg) {
    const light = cfg.backgroundGlow;
    const envelope = phase.beforeStart ? 0 : phase.reveal * phase.rings;
    this.group.visible = light?.present === true && light.enabled !== false && envelope > 0.001;
    if (!this.group.visible) return;
    // Ореол располагается за приёмником тени, но перед фоновым шейдером.
    this.group.position.set(light.offsetX, light.offsetY, -1.4);
    this.sprite.scale.setScalar(light.radius * 2);
    this.material.color.set(light.color);
    const pulse = 1 - light.pulse * 0.5 * (1 - Math.cos(time * light.speed * Math.PI * 2));
    this.material.opacity = light.intensity * envelope * pulse;
  }
}
