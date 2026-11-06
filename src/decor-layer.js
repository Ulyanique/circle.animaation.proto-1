import * as THREE from "three";
import { loopLocal } from "./scenes/cues.js";

const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Чистое состояние декора №2: только абсолютное время, конфиг и огибающая сцены.
 * @param {number} t @param {any} cfg @param {number} cycle @param {number} [envelope]
 */
export function decorState(t, cfg, cycle, envelope = 1) {
  const d = cfg?.decor || {};
  const preset = d.preset || "none";
  const base = clamp01(d.opacity ?? 0) * clamp01(envelope);
  if (preset === "none" || base <= 0.001) {
    return {
      preset: "none", opacity: 0, rotation: 0, pulse: 0,
      color: d.color || "#d9b061", scale: d.scale ?? 1, density: d.density ?? 1,
    };
  }
  const speed = Number(d.speed ?? 1) || 1;
  let turns = Math.round(speed);
  if (turns === 0) turns = 1;
  const phase = TAU * turns * loopLocal(t, cycle) / cycle;
  const pulse = 0.5 + 0.5 * Math.sin(phase);
  return {
    preset, opacity: base * (0.72 + 0.28 * pulse), rotation: phase, pulse,
    color: d.color || "#d9b061", scale: d.scale ?? 1, density: d.density ?? 1,
  };
}

/** @returns {THREE.CanvasTexture | null} */
function makeGlowTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,236,184,0.9)");
  g.addColorStop(0.35, "rgba(255,210,120,0.32)");
  g.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Декоративный слой №2: чертёжные дуги, мягкие блики/лучи и золотая пыль.
 * Все три пресета — чистые функции времени и конфига; на шве огибающая равна нулю. */
export class DecorLayer {
  /** @param {any} cfg */
  constructor(cfg) {
    this.group = new THREE.Group();
    this.group.name = "Phase2Decor";
    this.group.position.z = -1.15;
    this._color = new THREE.Color();
    this._glow = makeGlowTexture();
    this.arcs = new THREE.Group();
    this.rays = new THREE.Group();
    this.dust = new THREE.Group();
    this.group.add(this.arcs, this.rays, this.dust);
    this._build(cfg);
    this.group.visible = false;
  }

  /** @param {any} _cfg */
  _build(_cfg) {
    this.arcMat = new THREE.LineBasicMaterial({
      color: 0xd9b061, transparent: true, opacity: 0, depthTest: false,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    for (let i = 0; i < 3; i++) {
      const r = 1.75 + i * 0.62;
      const curve = new THREE.EllipseCurve(0, 0, r, r,
        0.12 * TAU + i * 0.42, 0.88 * TAU + i * 0.42, false, 0);
      const points = curve.getPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.arcMat);
      line.renderOrder = -3;
      this.arcs.add(line);
    }

    this.rayMat = new THREE.SpriteMaterial({
      map: this._glow, color: 0xffd98a, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    for (let i = 0; i < 10; i++) {
      const a = TAU * i / 10;
      const r = 2.15 + (i % 3) * 0.38;
      const sprite = new THREE.Sprite(this.rayMat);
      sprite.position.set(Math.cos(a) * r, Math.sin(a) * r, -0.1);
      sprite.scale.setScalar(0.32);
      sprite.renderOrder = -3;
      this.rays.add(sprite);
    }

    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = TAU * ((i * 0.61803398875) % 1);
      const r = 1.15 + ((i * 37) % 100) / 100 * 2.35;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r;
      positions[i * 3 + 2] = -0.2 + ((i * 17) % 10) / 100;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dustMat = new THREE.PointsMaterial({
      color: 0xd9b061, map: this._glow, size: 0.045, sizeAttenuation: true,
      transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, this.dustMat);
    this.dustPoints.renderOrder = -3;
    this.dust.add(this.dustPoints);
  }

  /** @param {number} t @param {any} cfg @param {number} cycle @param {number} envelope */
  update(t, cfg, cycle, envelope) {
    const s = decorState(t, cfg, cycle, envelope);
    const on = s.preset !== "none" && s.opacity > 0.001;
    this.group.visible = on;
    if (!on) return;
    const color = this._color.set(s.color);
    this.arcMat.color.copy(color);
    this.rayMat.color.copy(color);
    this.dustMat.color.copy(color);
    this.arcs.visible = s.preset === "blueprint-arcs" || s.preset === "sun-rays";
    this.rays.visible = s.preset === "blueprint-arcs" || s.preset === "sun-rays";
    this.dust.visible = s.preset === "gold-dust" || s.preset === "sun-rays";
    this.arcMat.opacity = s.opacity * (s.preset === "blueprint-arcs" ? 0.7 : 0.24);
    this.rayMat.opacity = s.opacity * (s.preset === "sun-rays" ? 0.45 : 0.16);
    this.dustMat.opacity = s.opacity * (s.preset === "gold-dust" ? 0.72 : 0.24);
    this.group.rotation.z = s.rotation;
    this.group.scale.setScalar(Math.max(0.2, Number(s.scale) || 1));
    const density = clamp01(Number(s.density) || 1);
    const arcCount = Math.max(1, Math.round(3 * density));
    const rayCount = Math.max(2, Math.round(10 * density));
    this.arcs.children.forEach((line, i) => { line.visible = i < arcCount; });
    this.rays.children.forEach((sprite, i) => {
      sprite.visible = i < rayCount;
      sprite.scale.setScalar(0.27 + 0.12 * s.pulse);
    });
  }

  dispose() {
    this.arcs.children.forEach((line) => line.geometry?.dispose());
    this.arcMat.dispose();
    this.rayMat.dispose();
    this.dustPoints.geometry.dispose();
    this.dustMat.dispose();
    this._glow?.dispose();
  }
}
