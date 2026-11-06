import * as THREE from "three";
import lygiaRandom from "./shaders/lygia-random.glsl?raw";
import { compositionFocus } from "./timeline.js";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uSeed;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFlare;
  // LYGIA generative/random.glsl, сохранены лицензия и исходные notices.
  ${lygiaRandom}
  void main() {
    vec2 jitter = (random2(uSeed) - 0.5) * 0.06;
    vec2 p = (vUv - 0.5) * 2.0 - jitter;
    float r = length(p);
    float a = atan(p.y, p.x);
    float blades = 0.48 + 0.028 * cos(a * 6.0 + uSeed);
    float disc = 1.0 - smoothstep(blades - 0.08, blades + 0.04, r);
    float rim = exp(-pow((r - blades) * 24.0, 2.0));
    float core = exp(-r * r * 34.0);
    float streak = exp(-abs(p.y) * 30.0) * (1.0 - smoothstep(0.2, 0.94, abs(p.x)));
    // Небольшой тёплый шестилепестковый объектив: не закрывает буквы и металл.
    float alpha = uOpacity * (0.14 * disc + 0.44 * rim + 0.15 * core + uFlare * 0.13 * streak);
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.85, 0.56), core * 0.35), alpha);
  }
`;

const smooth = (a, b, x) => {
  const v = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return v * v * (3 - 2 * v);
};

/** Небольшие детерминированные линзовые кружки, прикреплённые к крайним кольцам. */
export class SolarBokeh {
  /** @param {{distributed?: boolean}} [options] distributed — свободные кружки
   *  в остальных квадрантах; интро сохраняет только прежние блики у колец. */
  constructor({ distributed = true } = {}) {
    this.group = new THREE.Group();
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.discs = [];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 5; i++) {
        const seed = 11.37 + side * 23.1 + i * 9.71;
        const uniforms = {
          uColor: { value: new THREE.Color(side ? 0xffd18a : 0xffbc72) },
          uSeed: { value: seed },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uFlare: { value: i === 0 ? 1 : 0 },
        };
        const mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG, uniforms,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }));
        mesh.renderOrder = 2;
        this.group.add(mesh);
        this.discs.push({ mesh, uniforms, side, i, seed });
      }
    }
    // Свободные кружки в других квадрантах: блики распределены по всему кадру.
    // Координаты заданы в долях от угла: положительный x — правая часть кадра,
    // положительный y — верхняя. Пустые квадранты получают свои блики.
    this.free = (distributed ? [
      { at: [0.85, 0.62], size: 0.34, seed: 61.2, drift: 0.9 },
      { at: [-0.8, -0.7], size: 0.27, seed: 73.9, drift: 1.3 },
      { at: [0.5, -0.55], size: 0.22, seed: 88.4, drift: 0.7 },
      { at: [-0.55, 0.4], size: 0.19, seed: 95.1, drift: 1.1 },
    ] : []).map(({ at, size, seed, drift }) => {
      const uniforms = {
        uColor: { value: new THREE.Color(0xffc884) },
        uSeed: { value: seed },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uFlare: { value: 0 },
      };
      const mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }));
      mesh.renderOrder = 1;
      this.group.add(mesh);
      return { mesh, uniforms, at, size, seed, drift };
    });
  }

  update(t, ph, cfg, positions) {
    const env = cfg.rings.enabled ? ph.rings : 0;
    const focus = compositionFocus(ph, cfg.timeline);
    const sun = smooth(2.05, 2.9, ph.local) * (1 - smooth(3.5, 4.5, ph.local));
    this.group.visible = env > 0.001;
    for (const { mesh, uniforms, side, i, seed } of this.discs) {
      const base = side ? positions.right : positions.left;
      const dir = side ? -1 : 1;
      const radius = cfg.rings.radius;
      const angle = (side ? 2.74 : -0.4) + (i ? (i - 2) * 0.35 : 0);
      const distance = radius * (i ? 0.72 + i * 0.18 : 1.0);
      const drift = 0.025 * Math.sin(ph.local * 0.45 + seed);
      mesh.position.set(base.x + Math.cos(angle) * distance + drift * dir,
        base.y + Math.sin(angle) * distance + drift, -0.18 - i * 0.025);
      const size = (i === 0 ? 0.62 : [0, 0.22, 0.34, 0.17, 0.27][i]) * radius;
      mesh.scale.setScalar(size);
      uniforms.uTime.value = ph.local;
      uniforms.uOpacity.value = (i === 0 ? (0.15 + 0.7 * sun) : 0.20 + 0.06 * Math.sin(seed)) *
        env * (1 - 0.76 * focus);
    }
    // Равномерное поле: кружки держатся дальше от титра и не спорят с ним.
    for (const { mesh, uniforms, at, size, seed, drift } of this.free) {
      const baseX = at[0] < 0 ? positions.left.x : positions.right.x;
      const baseY = at[1] > 0 ? positions.left.y : positions.right.y;
      mesh.position.set(baseX * Math.abs(at[0]) + 0.05 * Math.sin(ph.local * 0.3 + drift),
        baseY * Math.abs(at[1]) + 0.04 * Math.cos(ph.local * 0.24 + drift), -0.24);
      mesh.scale.setScalar(size * cfg.rings.radius * 1.1);
      uniforms.uTime.value = ph.local;
      uniforms.uOpacity.value = (0.16 + 0.05 * Math.sin(seed)) * env * (1 - 0.82 * focus);
    }
  }

  dispose() {
    this.geometry.dispose();
    for (const { mesh } of this.discs) mesh.material.dispose();
    for (const { mesh } of this.free) mesh.material.dispose();
  }
}
