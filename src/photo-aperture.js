import * as THREE from 'three';
import { apertureSegments, apertureCue } from './scenes/aperture-layout.js';
/** Раскрывающаяся апертура перед появлением логотипа фотопаузы. */
export class PhotoAperture {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'photo-aperture';
    this.geometry = new THREE.BufferGeometry();
    const positions = apertureSegments();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.count = positions.length / 3;
    this.material = new THREE.LineBasicMaterial({color: '#e8c77e', transparent: true, opacity: 0, depthWrite: false});
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.group.add(this.lines);
  }
  update(phase, cfg, root) {
    const p = cfg.photo, cue = apertureCue(phase, cfg.timeline);
    this.group.position.set(root.position.x + p.apertureOffsetX, root.position.y + p.apertureOffsetY, -.08);
    this.group.scale.setScalar(p.apertureRadius);
    this.material.color.set(p.apertureColor);
    this.material.opacity = p.apertureOpacity * cue.opacity;
    const positions = this.geometry.getAttribute('position');
    positions.array.set(apertureSegments(cue.open)); positions.needsUpdate = true;
    this.group.visible = p.apertureEnabled && this.material.opacity > .001;
  }
  dispose() { this.group.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
