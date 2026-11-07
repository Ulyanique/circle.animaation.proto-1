import * as THREE from "three";
import { seededRandom } from "./random.js";

/* ─────────────────── Искры: всплеск при проявлении логотипа ─────────────────── */

const SPARK_VS = /* glsl */ `
  attribute vec3 aSpawn;
  attribute vec3 aVel;
  attribute float aBirth;   // 0..1 — доля интервала появления
  attribute float aLife;
  attribute float aSize;
  uniform float uT;         // секунды от начала появления, -1 — выключено
  uniform float uSpan;      // длительность интервала рождения
  uniform float uPixel;
  uniform float uSize;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uLifeMul;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying float vA;
  varying vec3 vC;
  void main(){
    float birth = aBirth * uSpan;
    float age = (uT - birth) / (aLife * uLifeMul);
    bool alive = uT >= 0.0 && age >= 0.0 && age <= 1.0;
    float dt = max(uT - birth, 0.0) * uSpeed;
    // ballistic: летят наружу и вверх, гравитация тянет вниз
    vec3 p = aSpawn + aVel * dt + vec3(0.0, -0.9 * dt * dt, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float fade = alive ? (1.0 - age) * smoothstep(0.0, 0.06, age) : 0.0;
    gl_PointSize = alive ? uSize * aSize * uPixel * (1.0 - 0.55 * age) / max(-mv.z, 0.1) : 0.0;
    vA = fade * uIntensity;
    vC = mix(uColA, uColB, fract(aBirth * 7.31));
  }
`;

const SPARK_FS = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float glow = core * core * core + core * 0.3;
    gl_FragColor = vec4(vC * vA, glow);
  }
`;

export class Sparks {
  constructor(logo) {
    this.logo = logo;
    this.sig = "";
    this.points = null;
    this.uniforms = {
      uT: { value: -1 },
      uSpan: { value: 1 },
      uPixel: { value: 60 },
      uSize: { value: 1 },
      uIntensity: { value: 1 },
      uSpeed: { value: 1 },
      uLifeMul: { value: 1 },
      uColA: { value: new THREE.Color(0xffd98a) },
      uColB: { value: new THREE.Color(0xffffff) },
    };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VS,
      fragmentShader: SPARK_FS,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  /** Искры рождаются на точках контура логотипа (в системе координат логотипа). */
  rebuild(cfg) {
    const sig = String(Math.round(cfg.sparks.count));
    if (sig === this.sig) return;
    this.sig = sig;
    if (this.points) {
      this.logo.root.remove(this.points);
      this.points.geometry.dispose();
      this.points = null;
    }
    const n = Math.max(0, Math.round(cfg.sparks.count));
    const anchors = this.logo.outlineAnchors;
    const segs = anchors ? anchors.length / 2 : 0;
    if (n === 0 || segs === 0) return;
    const K = this.logo.parsed.K;
    const spawn = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    const birth = new Float32Array(n), life = new Float32Array(n), size = new Float32Array(n);
    const rnd = seededRandom(0x5a93c721);
    for (let i = 0; i < n; i++) {
      const s = Math.floor(rnd() * segs);
      const x = anchors[s * 2] * K, y = -anchors[s * 2 + 1] * K;
      spawn.set([x, y, 0.32], i * 3);
      const len = Math.hypot(x, y) || 1;
      const out = 0.5 + rnd() * 1.1;
      vel.set([
        (x / len) * out + (rnd() - 0.5) * 0.9,
        (y / len) * out + 0.3 + rnd() * 1.0,
        (rnd() - 0.5) * 0.6,
      ], i * 3);
      birth[i] = rnd();
      life[i] = 0.5 + rnd() * 0.8;
      size[i] = 0.4 + rnd() * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("aSpawn", new THREE.BufferAttribute(spawn, 3));
    geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
    geo.setAttribute("aBirth", new THREE.BufferAttribute(birth, 1));
    geo.setAttribute("aLife", new THREE.BufferAttribute(life, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.logo.root.add(this.points);
  }

  update(emergeT, cfg, pixel, span) {
    this.rebuild(cfg);
    if (!this.points) return;
    const u = this.uniforms;
    this.points.visible = cfg.sparks.enabled && emergeT >= 0;
    u.uT.value = emergeT;
    u.uSpan.value = span;
    u.uPixel.value = pixel;
    u.uSize.value = cfg.sparks.size * 1.2;
    u.uIntensity.value = cfg.sparks.intensity;
    u.uSpeed.value = cfg.sparks.speed;
    u.uLifeMul.value = cfg.sparks.life;
    u.uColA.value.set(cfg.colors.goldHighlight);
    u.uColB.value.set(cfg.colors.gold).lerp(new THREE.Color(1, 1, 1), 0.4);
  }

  dispose() {
    this.points?.geometry.dispose();
    this.mat.dispose();
  }
}

/* ─────────────────── Анаморфный блик вдоль блика ─────────────────── */

const FLARE_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FLARE_FS = /* glsl */ `
  varying vec2 vUv;
  uniform float uI;
  uniform vec3 uColor;
  void main(){
    float x = abs(vUv.x - 0.5) * 2.0;
    float y = abs(vUv.y - 0.5) * 2.0;
    float core = exp(-y * y * 38.0);
    float streak = exp(-x * x * 1.8);
    float halo = exp(-y * y * 9.0) * exp(-x * x * 1.2) * 0.25;
    // Гасим обе составляющие до края плоскости, иначе ореол обрывается прямоугольником.
    float edge = (1.0 - smoothstep(0.60, 1.0, x)) * (1.0 - smoothstep(0.75, 1.0, y));
    vec3 col = uColor * (core * streak + halo) * edge * uI;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Координаты блика на перекладине SVG в локальной системе логотипа. */
export function flarePosition(glintX, glintIntensity) {
  return { x: glintIntensity > 0 ? glintX : 0, y: -.665 };
}

export class AnamorphicFlare {
  constructor() {
    this.uniforms = { uI: { value: 0 }, uColor: { value: new THREE.Color(0xfff0c8) } };
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: FLARE_VS,
        fragmentShader: FLARE_FS,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    this.mesh.scale.set(5.5, 0.6, 1);
    this.mesh.visible = false;
    this.mesh.renderOrder = 7;
  }

  set(x, intensity, color, y = -.665, width = 5.5, z = .2) {
    this.mesh.visible = intensity > 0.001;
    if (!this.mesh.visible) return;
    this.mesh.scale.set(width, 0.6, 1);
    this.mesh.position.set(x, y, z);
    this.uniforms.uI.value = intensity;
    this.uniforms.uColor.value.set(color);
  }
}
