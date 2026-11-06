import * as THREE from "three";
import { loopLocal } from "./scenes/cues.js";

const TAU = Math.PI * 2;
const TEXTURE_SIZE = 1024;
const TEXT_RADIUS_PX = 360;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Чистое состояние №8: целое число оборотов за цикл сохраняет бесшовный шов.
 * @param {number} t @param {any} cfg @param {number} cycle @param {number} [envelope]
 */
export function photoPauseState(t, cfg, cycle, envelope = 1) {
  const p = cfg?.photoPause || {};
  const fade = clamp01(envelope);
  const speed = Number(p.turns ?? 1) || 1;
  let turns = Math.round(speed);
  if (turns === 0) turns = 1;
  return {
    ...p,
    opacity: clamp01(p.opacity ?? 0) * fade,
    cornerOpacity: clamp01(p.cornerOpacity ?? 0) * fade,
    rotation: TAU * turns * loopLocal(t, cycle) / cycle,
    edgeCorners: cfg?.layout?.cornerBrackets !== false,
  };
}

/** Уголки по краям экрана и повторяющаяся по кругу строка «фотопауза • …». */
export class PhotoPauseDecor {
  /** @param {any} cfg */
  constructor(cfg) {
    this.group = new THREE.Group();
    this.group.name = "Phase2PhotoPauseDecor";
    this._canvas = typeof document === "undefined" ? null : document.createElement("canvas");
    if (this._canvas) {
      this._canvas.width = this._canvas.height = TEXTURE_SIZE;
    }
    this._texture = this._canvas ? new THREE.CanvasTexture(this._canvas) : null;
    if (this._texture) this._texture.colorSpace = THREE.SRGBColorSpace;
    this._textSig = "";
    this._edgeSig = "";

    this.quad = new THREE.PlaneGeometry(1, 1);
    this.planeMaterial = new THREE.MeshBasicMaterial({
      map: this._texture, transparent: true, opacity: 0, depthTest: false,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.circularText = new THREE.Mesh(this.quad, this.planeMaterial);
    this.circularText.renderOrder = -1;
    this.group.add(this.circularText);

    this.edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9b061, transparent: true, opacity: 0, depthTest: false,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.edgeGroup = new THREE.Group();
    this.edgeGroup.position.z = 0.5;
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.quad, this.edgeMaterial);
      mesh.renderOrder = 900;
      this.edgeGroup.add(mesh);
    }
    this.group.add(this.edgeGroup);
    this.update(0, cfg, cfg?.timeline?.holdDuration || 24, 0, 4.3, 2.4);
  }

  /** @param {any} cfg */
  _drawText(cfg) {
    if (!this._canvas || !this._texture) return;
    const p = cfg?.photoPause || {};
    const text = String(p.text || "фотопауза • ");
    const repeats = Math.max(3, Math.round(Number(p.repeats ?? 8) || 8));
    const fontSize = Math.max(12, Math.min(120, Number(p.fontSize ?? 42) || 42));
    const family = cfg?.caption?.fontFamily || "Cormorant Garamond";
    const weight = String(cfg?.caption?.fontWeight || "600");
    const color = p.color || cfg?.colors?.ringColor || "#d9b061";
    const sig = [text, repeats, fontSize, family, weight, color].join("|");
    if (sig === this._textSig) return;
    this._textSig = sig;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${fontSize}px "${family}", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    for (let i = 0; i < repeats; i++) {
      ctx.save();
      ctx.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
      ctx.rotate(TAU * i / repeats);
      ctx.fillText(text, 0, -TEXT_RADIUS_PX);
      ctx.restore();
    }
    this._texture.needsUpdate = true;
  }

  /** @param {number} t @param {any} cfg @param {number} cycle
   * @param {number} envelope @param {number} halfW @param {number} halfH */
  update(t, cfg, cycle, envelope, halfW, halfH) {
    const s = photoPauseState(t, cfg, cycle, envelope);
    const p = cfg?.photoPause || {};
    const on = s.opacity > 0.001 || (s.edgeCorners && s.cornerOpacity > 0.001);
    this.group.visible = on;
    if (!on) return;

    const color = p.color || cfg?.colors?.ringColor || "#d9b061";
    this.edgeMaterial.color.set(color);
    this.edgeMaterial.opacity = s.cornerOpacity;
    this.edgeGroup.visible = s.edgeCorners && s.cornerOpacity > 0.001;
    const inset = Math.max(0.02, Number(p.cornerInset ?? 0.22) || 0.22);
    const spanX = Math.max(0.1, halfW - inset);
    const spanY = Math.max(0.1, halfH - inset);
    const length = Math.max(0.05, Number(p.cornerLength ?? 0.42) || 0.42);
    const thick = Math.max(0.002, Number(p.cornerThickness ?? 0.012) || 0.012);
    const lx = Math.min(0.95, length / spanX);
    const ly = Math.min(0.95, length / spanY);
    const tx = Math.min(0.08, thick / spanX);
    const ty = Math.min(0.08, thick / spanY);
    const sig = [lx, ly, tx, ty].map((v) => v.toFixed(4)).join("|");
    if (sig !== this._edgeSig) {
      this._edgeSig = sig;
      let idx = 0;
      for (const signX of [-1, 1]) for (const signY of [-1, 1]) {
        const horizontal = this.edgeGroup.children[idx++];
        horizontal.position.set(signX * (1 - lx / 2), signY * (1 - ty / 2), 0);
        horizontal.scale.set(lx, ty, 1);
        const vertical = this.edgeGroup.children[idx++];
        vertical.position.set(signX * (1 - tx / 2), signY * (1 - ly / 2), 0);
        vertical.scale.set(tx, ly, 1);
      }
    }
    this.edgeGroup.scale.set(spanX, spanY, 1);

    const radius = Math.max(0.4, Number(p.radius ?? 1.35) || 1.35);
    const planeSize = 2 * radius * (TEXTURE_SIZE / 2 / TEXT_RADIUS_PX);
    this._drawText(cfg);
    this.circularText.scale.set(planeSize, planeSize, 1);
    this.circularText.position.set(0, cfg?.layout?.logoY ?? 0, -0.1);
    this.circularText.rotation.z = s.rotation;
    this.planeMaterial.opacity = s.opacity;
    this.circularText.visible = s.opacity > 0.001;
  }

  dispose() {
    this.quad.dispose();
    this.planeMaterial.dispose();
    this.edgeMaterial.dispose();
    this._texture?.dispose();
  }
}
