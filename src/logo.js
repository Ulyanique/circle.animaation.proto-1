import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import svgText from "./assets/logo.svg?raw";

/**
 * Логотип: SVG → экструзия с фасками (золото), проявление из тени
 * радиальным шумовым фронтом (шейдер), и прорисовка контура толстой линией.
 */

const HEAD_COLOR = new THREE.Color(1, 0.97, 0.85);
const LOGO_WIDTH = 3.2; // ширина логотипа в мировых единицах

// Общие uniform'ы, которые читает шейдер проявления
export const revealUniforms = {
  uReveal: { value: 0 },
  uRevealNoise: { value: 0.2 },
  uRevealGlow: { value: 2 },
  uGlowColor: { value: new THREE.Color(1, 0.7, 0.3) },
  uK: { value: 1 },
  uCenter: { value: new THREE.Vector2(0, 0) },
};

const REVEAL_GLSL_COMMON = /* glsl */ `
  varying vec3 vLocalPos;
  uniform float uReveal;
  uniform float uRevealNoise;
  uniform float uRevealGlow;
  uniform vec3 uGlowColor;
  uniform float uK;
  uniform vec2 uCenter;
  float rvHash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float rvNoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(rvHash(i),rvHash(i+vec2(1,0)),u.x), mix(rvHash(i+vec2(0,1)),rvHash(i+vec2(1,1)),u.x), u.y);
  }
  float rvField(vec2 p){
    float n = rvNoise(p*3.1)*0.6 + rvNoise(p*9.7)*0.3 + rvNoise(p*23.0)*0.1;
    return length(p - uCenter) + (n - 0.5) * uRevealNoise * 2.0;
  }
`;

function patchRevealMaterial(material, withEmission) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, revealUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocalPos;\nuniform float uK;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position * uK;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + REVEAL_GLSL_COMMON)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         float rvF = rvField(vLocalPos.xy);
         if (rvF > uReveal || uReveal <= 0.0) discard;`
      );
    if (withEmission) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float rvEdge = 1.0 - smoothstep(0.0, 0.14, uReveal - rvF);
         totalEmissiveRadiance += uGlowColor * uRevealGlow * rvEdge;`
      );
    }
  };
  material.customProgramCacheKey = () => "reveal-" + withEmission;
  return material;
}

function patchRevealDepth(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, revealUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocalPos;\nuniform float uK;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position * uK;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + REVEAL_GLSL_COMMON)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         if (rvField(vLocalPos.xy) > uReveal || uReveal <= 0.0) discard;`
      );
  };
  material.customProgramCacheKey = () => "reveal-depth";
  return material;
}

/** Разбор SVG → набор подконтуров (для прорисовки) и шейп'ов (для экструзии) */
function parseLogo() {
  const data = new SVGLoader().parse(svgText);
  const shapes = [];
  const subPaths = [];
  for (const p of data.paths) {
    shapes.push(...SVGLoader.createShapes(p));
    for (const sp of p.subPaths) subPaths.push(sp);
  }
  // bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sp of subPaths) {
    for (const pt of sp.getPoints(16)) {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
    }
  }
  const W = maxX - minX;
  return {
    shapes,
    subPaths,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    W,
    K: LOGO_WIDTH / W, // svg-единицы → мировые
  };
}

export class Logo {
  constructor() {
    this.parsed = parseLogo();
    this.root = new THREE.Group();          // позиция/масштаб/покачивание
    this.body = new THREE.Group();          // масштаб SVG → мир (с отражением Y)
    this.body.scale.set(this.parsed.K, -this.parsed.K, this.parsed.K);
    this.root.add(this.body);

    this.material = patchRevealMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xc8962e,
        metalness: 1,
        roughness: 0.22,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.25,
        emissive: 0x000000,
      }),
      true
    );
    this.depthMaterial = patchRevealDepth(
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    );

    this.mesh = null;
    this.outline = null;
    this.outlineMat = null;
    this.outlineCopies = [];
    this.buildSig = null;
    this.outlineThresholds = null;
    this.buildOutline();
  }

  /** Перестраивает экструзию, если изменились толщина/скос. */
  rebuildIfNeeded(cfg) {
    const sig = [cfg.logo.depth, cfg.logo.bevel].join("|");
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    if (this.mesh) {
      this.body.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const { shapes, K } = this.parsed;
    const depthSvg = Math.max(0.001, cfg.logo.depth / K);
    const bevelSvg = Math.max(0, cfg.logo.bevel / K);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depthSvg,
      bevelEnabled: bevelSvg > 0,
      bevelThickness: bevelSvg,
      bevelSize: bevelSvg * 0.8,
      bevelOffset: 0,
      bevelSegments: 6,
      curveSegments: 40,
    });
    geo.computeVertexNormals();
    // центрируем геометрию (x,y по bbox, z — по середине экструзии)
    geo.translate(-this.parsed.cx, -this.parsed.cy, -depthSvg / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.body.add(this.mesh);
    this.depthSvg = depthSvg;
    this.frontZ = depthSvg / 2 + bevelSvg;
    // контур лежит на лицевой грани (поверх скоса)
    if (this.outline) this.outline.position.z = this.frontZ + 0.6 / K;
  }

  /** Контур: все подконтуры → отрезки; у каждого отрезка порог появления по времени. */
  buildOutline() {
    const { subPaths, cx, cy, W } = this.parsed;
    const positions = [];
    const thresholds = [];
    const STAGGER = 0.3; // подконтуры начинают рисоваться со сдвигом
    const n = Math.max(1, subPaths.length);
    subPaths.forEach((sp, i) => {
      const len = sp.getLength();
      const divs = Math.max(8, Math.ceil(len / (W / 500)));
      const pts = sp.getSpacedPoints(divs);
      const start = (i / n) * STAGGER;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        positions.push(a.x - cx, -(a.y - cy), 0, b.x - cx, -(b.y - cy), 0);
        thresholds.push(
          start + (k / (pts.length - 1)) * (1 - STAGGER),
          start + ((k + 1) / (pts.length - 1)) * (1 - STAGGER)
        );
      }
    });
    this.outlineThresholds = new Float32Array(thresholds);
    this.outlinePositions = new Float32Array(positions);
    this.outlineSegCount = positions.length / 6;
    this.outlineColors = new Float32Array(positions.length); // чёрный = невидим при аддитивном

    const colorAttr = new THREE.BufferAttribute(this.outlineColors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.outlineColorAttr = colorAttr;

    this.outlineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // несколько смещённых копий дают «толщину» линии (нативные линии WebGL = 1px)
    this.outline = new THREE.Group();
    this.outlineCopies = [];
    const OFF = 5.0; // в единицах SVG
    const offsets = [[0, 0], [OFF, 0], [-OFF, 0], [0, OFF], [0, -OFF]];
    for (const [ox, oy] of offsets) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(positions.length);
      for (let k = 0; k < positions.length; k += 3) {
        pos[k] = positions[k] + ox;
        pos[k + 1] = positions[k + 1] + oy;
        pos[k + 2] = positions[k + 2];
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", colorAttr);
      const seg = new THREE.LineSegments(geo, this.outlineMat);
      seg.frustumCulled = false;
      this.outline.add(seg);
      this.outlineCopies.push(seg);
    }
    this.body.add(this.outline);
  }

  setResolution() {}

  /**
   * Обновляет состояние контура.
   * draw: 0..1 — сколько контура нарисовано; opacity — общая прозрачность.
   */
  updateOutline(draw, opacity, cfg) {
    this.outline.visible = cfg.logo.outlineEnabled && opacity > 0.001;
    if (!this.outline.visible) return;
    const arr = this.outlineColors;
    const th = this.outlineThresholds;
    this._base = this._base || new THREE.Color();
    const base = this._base.set(cfg.logo.outlineColor);
    const head = HEAD_COLOR;
    const bR = base.r * 0.9, bG = base.g * 0.9, bB = base.b * 0.9;
    const HEAD_W = 0.025;
    for (let s = 0; s < this.outlineSegCount; s++) {
      const t0 = th[s * 2], t1 = th[s * 2 + 1];
      const v0 = Math.min(1, Math.max(0, (draw - t0) / 0.012));
      const v1 = Math.min(1, Math.max(0, (draw - t1) / 0.012));
      const h0 = Math.exp(-Math.pow((draw - t0) / HEAD_W, 2));
      const h1 = Math.exp(-Math.pow((draw - t1) / HEAD_W, 2));
      const o = s * 6;
      arr[o + 0] = bR * v0 + head.r * h0 * v0;
      arr[o + 1] = bG * v0 + head.g * h0 * v0;
      arr[o + 2] = bB * v0 + head.b * h0 * v0;
      arr[o + 3] = bR * v1 + head.r * h1 * v1;
      arr[o + 4] = bG * v1 + head.g * h1 * v1;
      arr[o + 5] = bB * v1 + head.b * h1 * v1;
    }
    this.outlineColorAttr.needsUpdate = true;
    this.outlineMat.opacity = cfg.logo.outlineOpacity * opacity;
  }

  dispose() {
    for (const c of this.outlineCopies) c.geometry.dispose();
    this.mesh?.geometry.dispose();
    this.outlineMat?.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
  }
}
