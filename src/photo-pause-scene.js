import * as THREE from "three";
import { BrandScene } from "./brand-scene.js";
import { computePhase } from "./timeline.js";
import { captionState } from "./caption.js";
import { fontName } from "./fonts.js";
import { circularGlyphLayout, viewfinderSegments } from "./scenes/photo-layout.js";

const TEX_SIZE = 1024;
const FRAME_DEPTH = 5;

/** №8: центрированный знак, кольцо из текста и уголки у границ кадра. */
export class PhotoPauseScene extends BrandScene {
  constructor(canvas, config) {
    super(canvas, config, { contourWaves: true });
    this.frameSig = '';
    this.textSig = '';
    this.disposed = false;
    this.viewfinder = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      color: 0xdab46f, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
    }));
    this.viewfinder.position.z = -FRAME_DEPTH;
    this.viewfinder.renderOrder = 20;
    // Камера входит в граф сцены, иначе её дочерние уголки не рисуются.
    this.scene.add(this.camera);
    this.camera.add(this.viewfinder);

    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = TEX_SIZE; this.labelCanvas.height = TEX_SIZE;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTexture.colorSpace = THREE.SRGBColorSpace;
    this.labelTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.circularLabel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: this.labelTexture, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      toneMapped: false,
    }));
    this.circularLabel.renderOrder = 10;
    this.scene.add(this.circularLabel);
    // Если шрифты догрузились после первого кадра, перерисовываем текстуру.
    document.fonts?.ready.then(() => { if (!this.disposed) this.textSig = ''; });
  }

  refreshTextTexture() { this.textSig = ''; }

  updateText(config) {
    const p = config.photo;
    const family = fontName(config.typography?.font);
    const sig = [p.text, p.repeats, p.radius, p.fontSize, p.color, family].join('|');
    if (sig === this.textSig) return;
    this.textSig = sig;
    const diameter = 2 * (p.radius + p.fontSize * 1.3);
    const pixelsPerUnit = TEX_SIZE / diameter;
    const radius = p.radius * pixelsPerUnit;
    const ctx = this.labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.font = `600 ${p.fontSize * pixelsPerUnit}px "${family}", Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = p.color;
    const layout = circularGlyphLayout(p.text, p.repeats, radius, glyph => ctx.measureText(glyph).width);
    for (const { glyph, angle, scale } of layout) {
      if (!glyph.trim()) continue;
      ctx.save();
      ctx.translate(TEX_SIZE / 2 + Math.cos(angle) * radius, TEX_SIZE / 2 + Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      ctx.scale(scale, scale);
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    }
    this.labelTexture.needsUpdate = true;
    this.circularLabel.scale.set(diameter, diameter, 1);
  }

  update(t, dt) {
    super.update(t, dt);
    const cfg = this.cfg, p = cfg.photo;
    const phase = computePhase(t, cfg.timeline);
    const title = captionState(t, cfg.timeline).lines.title.outline;
    this.updateText(cfg);
    this.circularLabel.position.set(this.logo.root.position.x, this.logo.root.position.y, 0.1);
    this.circularLabel.rotation.z = -phase.local * p.rotationSpeed;
    this.circularLabel.material.opacity = p.textOpacity * title;
    this.circularLabel.visible = p.textEnabled && this.circularLabel.material.opacity > 0.001;

    // Камерная плоскость удерживает уголки у краёв даже при движении камеры и любом формате окна.
    const sig = [this.camera.fov, this.camera.aspect, p.frameMargin, p.frameLength].join('|');
    if (sig !== this.frameSig) {
      this.frameSig = sig;
      const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * FRAME_DEPTH;
      const vertices = viewfinderSegments(halfH * this.camera.aspect, halfH, p.frameMargin, p.frameLength);
      this.viewfinder.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      this.viewfinder.geometry.computeBoundingSphere();
    }
    this.viewfinder.material.color.set(p.color);
    this.viewfinder.material.opacity = p.frameOpacity * phase.reveal * phase.rings;
    this.viewfinder.visible = p.frameEnabled && this.viewfinder.material.opacity > 0.001;
  }

  dispose() {
    this.disposed = true;
    this.viewfinder.removeFromParent();
    this.viewfinder.geometry.dispose();
    this.viewfinder.material.dispose();
    this.circularLabel.removeFromParent();
    this.circularLabel.geometry.dispose();
    this.circularLabel.material.dispose();
    this.labelTexture.dispose();
    super.dispose();
  }
}
