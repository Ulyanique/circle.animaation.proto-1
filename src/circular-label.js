import * as THREE from 'three';
import { validCustomColor } from './caption-content.js';
import { fontName } from './fonts.js';
import { circularGlyphLayout, photoLabelCenter } from './scenes/photo-layout.js';

const TEX_SIZE = 1024;
/** Одна и та же круговая надпись для фирменного фона и фотопаузы. */
export class CircularLabel {
  constructor(scene, renderer) {
    this.textSig = '';
    this.disposed = false;
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_SIZE; this.canvas.height = TEX_SIZE;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
    document.fonts?.ready.then(() => { if (!this.disposed) this.textSig = ''; });
  }
  refreshTextTexture() { this.textSig = ''; }
  updateText(config) {
    const p = config.photo, family = fontName(config.typography?.font);
    const sig = [p.text, p.repeats, p.radius, p.fontSize, p.color, p.textColor, family].join('|');
    if (sig === this.textSig) return;
    this.textSig = sig;
    const diameter = 2 * (p.radius + p.fontSize * 1.3);
    const pixelsPerUnit = TEX_SIZE / diameter, radius = p.radius * pixelsPerUnit;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.font = `600 ${p.fontSize * pixelsPerUnit}px "${family}", Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = validCustomColor(p.textColor) ?? p.color;
    const layout = circularGlyphLayout(p.text, p.repeats, radius, glyph => ctx.measureText(glyph).width);
    for (const { glyph, angle, scale } of layout) {
      if (!glyph.trim()) continue;
      ctx.save();
      ctx.translate(TEX_SIZE / 2 + Math.cos(angle) * radius, TEX_SIZE / 2 + Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2); ctx.scale(scale, scale); ctx.fillText(glyph, 0, 0); ctx.restore();
    }
    this.texture.needsUpdate = true;
    this.mesh.scale.set(diameter, diameter, 1);
  }
  update(config, phase, title, root) {
    const p = config.photo;
    this.updateText(config);
    const center = photoLabelCenter(root.position, p);
    this.mesh.position.set(center.x, center.y, 0.1);
    this.mesh.rotation.z = -phase.local * p.rotationSpeed;
    this.mesh.material.opacity = p.textOpacity * title;
    this.mesh.visible = p.textEnabled && this.mesh.material.opacity > 0.001;
  }
  dispose() {
    this.disposed = true;
    this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
  }
}
