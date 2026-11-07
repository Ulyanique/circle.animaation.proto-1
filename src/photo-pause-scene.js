import * as THREE from "three";
import { PhotoAperture } from "./photo-aperture.js";
import { BrandScene } from "./brand-scene.js";
import { computePhase } from "./timeline.js";
import { viewfinderSegments, framePulseScale } from "./scenes/photo-layout.js";

const FRAME_DEPTH = 5;

/** №8: центрированный знак, кольцо из текста и уголки у границ кадра. */
export class PhotoPauseScene extends BrandScene {
  constructor(canvas, config) {
    super(canvas, config, { contourWaves: true, decor: false, photoSpin: true });
    this.aperture = new PhotoAperture();
    this.scene.add(this.aperture.group);
    this.frameSig = '';
    this.viewfinder = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      color: 0xdab46f, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    }));
    this.viewfinder.position.z = -FRAME_DEPTH;
    this.viewfinder.renderOrder = 20;
    this.scene.add(this.camera);
    this.camera.add(this.viewfinder);
  }
  update(t, dt) {
    super.update(t, dt);
    const cfg = this.cfg, p = cfg.photo;
    const phase = computePhase(t, cfg.timeline);
    this.aperture.update(phase, cfg, this.logo.root);
    // На входе апертура заменяет старую рисующую окружность; обратный уход не меняем.
    if (p.apertureEnabled && !phase.beforeStart && phase.local < cfg.timeline.drawDuration + cfg.timeline.emergeDuration * .15) this.plotter.group.visible = false;
    // Внутренний пунктир следует за знаком; радиус можно менять независимо от текста.
    this.corners.centerRing.position.set(this.logo.root.position.x, this.logo.root.position.y, -0.05);
    this.corners.centerRing.scale.setScalar(p.ringRadius);
    // Камерная плоскость удерживает уголки у границ кадра при любом формате окна.
    const sig = [this.camera.fov, this.camera.aspect, p.frameMargin, p.frameLength].join('|');
    if (sig !== this.frameSig) {
      this.frameSig = sig;
      const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * FRAME_DEPTH;
      const vertices = viewfinderSegments(halfH * this.camera.aspect, halfH, p.frameMargin, p.frameLength);
      this.viewfinder.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      this.viewfinder.geometry.computeBoundingSphere();
    }
    this.viewfinder.scale.setScalar(framePulseScale(phase.local, phase.cycle, p.framePulse, p.framePulseCycles));
    this.viewfinder.material.color.set(p.color);
    this.viewfinder.material.opacity = p.frameOpacity * phase.reveal * phase.rings;
    this.viewfinder.visible = p.frameEnabled && this.viewfinder.material.opacity > 0.001;
  }
  dispose() {
    this.aperture.dispose();
    this.viewfinder.removeFromParent(); this.viewfinder.geometry.dispose(); this.viewfinder.material.dispose();
    super.dispose();
  }
}
