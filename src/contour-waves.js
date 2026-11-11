import * as THREE from "three";
import svgText from "./assets/logo.svg?raw";
import { exteriorDistance, packDistances } from "./outer-distance.js";
import { CONTOUR_WAVE_COUNT, contourWave } from "./scenes/cues.js";

const SIZE = 512;
const MAX_DISTANCE = 128; // пиксели маски, за которыми волна уже растворилась
let cachedMask = null;

/** Общая маска объединённого силуэта; внутренние отверстия заполняются. */
function silhouetteMask(logo) {
  if (cachedMask) return cachedMask;
  const { subPaths, cx, cy, W, K } = logo.parsed;
  let minY = Infinity, maxY = -Infinity;
  for (const path of subPaths) for (const point of path.getPoints(16)) {
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  // Запас вокруг формы нужен именно для смещения края наружу, а не для масштабирования копии.
  const extent = Math.max(W, maxY - minY) * 1.9;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = SIZE / extent;
  ctx.setTransform(scale, 0, 0, scale, SIZE / 2 - cx * scale, SIZE / 2 - cy * scale);
  ctx.fillStyle = '#fff';
  for (const path of new DOMParser().parseFromString(svgText, 'image/svg+xml').querySelectorAll('path[d]')) {
    ctx.fill(new Path2D(path.getAttribute('d')), 'evenodd');
  }
  const rgba = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const alpha = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
  const distances = exteriorDistance(alpha, SIZE, SIZE);
  const pixels = packDistances(distances, MAX_DISTANCE);
  cachedMask = { pixels, worldSize: extent * K };
  return cachedMask;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vScreenY;
  void main() {
    vUv = uv;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreenY = clip.y / clip.w;
    gl_Position = clip;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uDistance;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uCaptionSafe;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vScreenY;
  void main() {
    // Текстура хранит расстояние только от ВНЕШНЕЙ границы объединённого силуэта.
    vec4 packed = texture2D(uDistance, vec2(vUv.x, 1.0 - vUv.y));
    float dist = (packed.r * 255.0 * 256.0 + packed.g * 255.0) / 65535.0 * (128.0 / 512.0);
    // Субпиксельное сглаживание без широкой светящейся полосы.
    float width = max(fwidth(dist) * 0.35, 0.0001);
    float line = 1.0 - smoothstep(width * 0.15, width * 1.6, abs(dist - uRadius));
    float captionMask = mix(1.0, smoothstep(-0.42, -0.22, vScreenY), uCaptionSafe);
    gl_FragColor = vec4(uColor, line * uOpacity * captionMask);
  }
`;

/** Тонкие волны на равном расстоянии от внешних краёв знака, не копии его деталей. */
export class ContourWaves {
  constructor(logo) {
    this.logo = logo;
    this.group = new THREE.Group();
    this.group.name = "contour-waves";
    const mask = silhouetteMask(logo);
    this.worldSize = mask.worldSize;
    this.texture = new THREE.DataTexture(mask.pixels, SIZE, SIZE, THREE.RGBAFormat);
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.geometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize);
    this.layers = [];
    for (let index = 0; index < CONTOUR_WAVE_COUNT; index++) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uDistance: { value: this.texture }, uRadius: { value: 0 },
          uOpacity: { value: 0 }, uColor: { value: new THREE.Color() },
          uCaptionSafe: { value: 1 },
        },
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const layer = new THREE.Mesh(this.geometry, material);
      layer.frustumCulled = false;
      this.group.add(layer);
      this.layers.push({ layer, material });
    }
  }

  update(time, phase, cfg) {
    const root = this.logo.root;
    const visibility = THREE.MathUtils.smoothstep(phase.reveal, 0.45, 1) * phase.rings;
    this.group.visible = cfg.logo.outlineEnabled && visibility > 0.001;
    if (!this.group.visible) return;
    this.group.position.set(root.position.x, root.position.y, root.position.z - 0.03);
    this.group.rotation.copy(root.rotation);
    this.group.scale.copy(root.scale);
    for (let index = 0; index < this.layers.length; index++) {
      const { layer, material } = this.layers[index];
      const wave = contourWave(time, index);
      material.uniforms.uRadius.value = wave.distance / this.worldSize;
      material.uniforms.uColor.value.set(cfg.logo.outlineColor);
      // У фотопаузы титр круговой, поэтому волны не обрезаются снизу.
      material.uniforms.uCaptionSafe.value = cfg.photo ? 0 : 1;
      material.uniforms.uOpacity.value = wave.opacity * visibility;
      layer.visible = material.uniforms.uOpacity.value > 0.001;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const { material } of this.layers) material.dispose();
    this.geometry.dispose();
    this.texture.dispose();
  }
}
