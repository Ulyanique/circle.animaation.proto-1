import * as THREE from "three";
import { OUTPUT } from "./scenes/catalog.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import svgText from "./assets/logo.svg?raw";
import { createGoldSurfaceMaps, findMedallionHole, LOGO_BEVEL_SEGMENTS, LOGO_BEVEL_WIDTH_RATIO } from "./gold-material-maps.js";

export { LOGO_BEVEL_SEGMENTS, LOGO_BEVEL_WIDTH_RATIO };

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
  uSpecPass: { value: 0 },
  uSpecX: { value: 0 },
  uFacetPolish: { value: 0 },
  uStudioRelief: { value: 0 },
  uCinematicGold: { value: 0 },
  uCinematicTime: { value: 0 },
  // Мягкая куполообразность лицевой плоскости: плоская грань иначе отражает
  // окружение одной точкой и выглядит заливкой.
  uDome: { value: 0.12 },
  uAmber: { value: 0.4 },
};

const REVEAL_GLSL_COMMON = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vLocalNormal;
  uniform float uReveal;
  uniform float uRevealNoise;
  uniform float uRevealGlow;
  uniform vec3 uGlowColor;
  uniform float uK;
  uniform vec2 uCenter;
  uniform float uSpecPass;
  uniform float uSpecX;
  uniform float uFacetPolish;
  uniform float uStudioRelief;
  uniform float uCinematicGold;
  uniform float uCinematicTime;
  uniform float uDome;
  uniform float uAmber;
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
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocalPos;\nvarying vec3 vLocalNormal;\nuniform float uK;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position * uK;\nvLocalNormal = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + REVEAL_GLSL_COMMON)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         float rvF = rvField(vLocalPos.xy);
         if (rvF > uReveal || uReveal <= 0.0) discard;`
      );
    if (withEmission) {
      // Лицо знака — почти плоскость. Слегка «выпуклый» нормаль даёт мягкое
      // скольжение отражения софтбокса по металлу вместо равномерной заливки.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
         float rvFaceMask = smoothstep(0.55, 0.95, abs(vLocalNormal.z));
         vec2 rvDome = vLocalPos.xy * uDome;
         normal = normalize(normal + vec3(rvDome, 0.0) * rvFaceMask);`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float rvEdge = 1.0 - smoothstep(0.0, 0.14, uReveal - rvF);
         totalEmissiveRadiance += uGlowColor * uRevealGlow * rvEdge;`
      );
      // Студийное окружение остаётся HDR, но на металле мягко сжимаем пики
      // по каналам: так золото сохраняет объём вместо белого пересвета.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `outgoingLight = outgoingLight / (1.0 + outgoingLight / vec3(1.10, 0.48, 0.16));
         // Тёплый студийный градиент только на лицевой поверхности:
         // от светлой верхней левой кромки к более глубокому янтарю справа внизу.
         // На боковых гранях сохраняем естественное отражение окружения.
         float rvFront = smoothstep(0.55, 0.92, abs(vLocalNormal.z));
         float rvShade = smoothstep(-1.45, 1.35, vLocalPos.x + vLocalPos.y * 0.22);
         // Тень остаётся тёплой: золото не должно уходить в серый пластик.
         vec3 rvFaceTone = mix(vec3(0.98, 0.95, 0.88), vec3(0.74, 0.66, 0.54), rvShade);
         outgoingLight *= mix(vec3(1.0), rvFaceTone, rvFront);
         // Широкий мягкий градиент отражения на лицевой плоскости и
         // отдельный акцент скоса. Он усиливает объём без новой геометрии,
         // белых пятен и мелких высокочастотных полос; ноль даёт прежний вид.
         float rvNormalZ = abs(normalize(vLocalNormal).z);
         float rvBevel = smoothstep(0.08, 0.45, rvNormalZ) * (1.0 - smoothstep(0.90, 0.995, rvNormalZ));
         float rvFaceLight = smoothstep(-1.5, 1.5, -vLocalPos.x + vLocalPos.y * 0.35);
         float rvPolish = clamp(uFacetPolish, 0.0, 1.0);
         outgoingLight *= 1.0 + rvPolish * (rvFront * (rvFaceLight - 0.5) * 0.20 + rvBevel * 0.12);
         // Широкие отражения студийных флагов дают лицу знака глубину;
         // они закреплены в координатах металла и медленно сдвигаются во времени.
         float rvCardCoord = vLocalPos.x + vLocalPos.y * 0.48 + 0.16 * sin(uCinematicTime * 0.24);
         float rvCard = exp(-pow((rvCardCoord + 0.52) * 1.35, 2.0));
         float rvDarkCard = exp(-pow((rvCardCoord - 0.55) * 1.35, 2.0));
         float rvEdgeCard = exp(-pow((rvCardCoord + 0.05) * 5.0, 2.0));
         // Основа карточки больше не уводит теневую сторону в чёрный:
         // настоящие отражения окружения уже дают объём.
         float rvStudio = 0.84 + 0.36 * rvCard - 0.05 * rvDarkCard;
         outgoingLight *= mix(1.0, rvStudio, rvFront * uCinematicGold);
         outgoingLight += vec3(0.17, 0.075, 0.018) * (rvCard * rvBevel + 0.32 * rvEdgeCard * rvFront) * uCinematicGold;
         // Янтарный срез: тонкий тёплый свет на боковых гранях, как у полированного
         // камня. Ноль возвращает чистое золото.
         float rvAmberSide = 1.0 - smoothstep(0.06, 0.40, abs(normalize(vLocalNormal).z));
         outgoingLight += vec3(0.26, 0.095, 0.014) * rvAmberSide * clamp(uAmber, 0.0, 1.0);
         // Настоящие нормали скоса: широкая студийная карточка освещает
         // верхние кромки, противоположные остаются глубоким металлом.
         // Ноль сохраняет прежний материал; плоское лицо не получает полосу.
         vec3 rvN = normalize(vec3(vLocalNormal.x, -vLocalNormal.y, vLocalNormal.z));
         vec3 rvSoftbox = normalize(vec3(-0.48, 0.72, 0.50));
         float rvEdgeLight = pow(max(dot(rvN, rvSoftbox), 0.0), 2.0);
         float rvRim = rvBevel * clamp(uStudioRelief, 0.0, 1.0);
         outgoingLight *= 1.0 + rvRim * (1.45 * rvEdgeLight - 0.20);
         outgoingLight += outgoingLight * rvRim * rvEdgeLight * 0.65;
         // Отражение большого софтбокса тянется по граням лица; это не
         // движущийся в экранном пространстве блик и не меняет силуэт.
         float rvFaceCoord = vLocalPos.x + vLocalPos.y * 0.62 + 0.18 * sin(uCinematicTime * 0.18);
         float rvFaceCard = exp(-pow((rvFaceCoord + 0.42) * 2.0, 2.0));
         float rvRelief = clamp(uStudioRelief, 0.0, 1.0);
         outgoingLight *= 1.0 + rvRelief * rvFront * (0.52 * rvFaceCard - 0.15);
         // Боковые поверхности и теневая сторона скоса остаются тёмным
         // отражающим металлом, а не плоской заливкой. Геометрия не меняется.
         float rvSide = 1.0 - smoothstep(0.10, 0.48, rvNormalZ);
         float rvShadowEdge = rvBevel * (1.0 - rvEdgeLight);
         outgoingLight *= 1.0 - rvRelief * (0.32 * rvSide + 0.16 * rvShadowEdge);
         float rvSlimCard = exp(-pow((rvFaceCoord + 0.18) * 4.5, 2.0));
         outgoingLight += vec3(0.11, 0.055, 0.015) * rvRelief * rvFront * rvSlimCard;
         // Микрогравировка в локальных координатах: не плавает по поверхности.
         // Производная подавляет муар, если линии становятся мельче пикселя.
         float rvBrush = vLocalPos.y * 110.0 + sin(vLocalPos.x * 9.0) * 0.32;
         float rvAA = 1.0 - smoothstep(0.7, 1.8, fwidth(rvBrush));
         outgoingLight *= 1.0 - 0.032 * rvAA * (0.5 + 0.5 * sin(rvBrush));
         // Узкое отражение студийного источника: движется только по металлу,
         // остаётся янтарным и не превращается в белую вспышку по всему кадру.
         float rvBandCoord = vLocalPos.x - uSpecX;
         float rvCrossbar = 1.0 - smoothstep(0.10, 0.22, abs(vLocalPos.y + 0.665));
         float rvSpecBand = exp(-rvBandCoord * rvBandCoord * 22.0) * rvFront * rvCrossbar * uSpecPass;
         outgoingLight += vec3(0.38, 0.15, 0.035) * rvSpecBand;
         #include <opaque_fragment>`
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

function patchAmberInsetMaterial(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, revealUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocalPos;\nvarying vec3 vLocalNormal;\nuniform float uK;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalPos = position * uK;\nvLocalNormal = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + REVEAL_GLSL_COMMON)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         float rvF = rvField(vLocalPos.xy);
         if (rvF > uReveal || uReveal <= 0.0 || uAmber <= 0.001) discard;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float rvEdge = 1.0 - smoothstep(0.0, 0.14, uReveal - rvF);
         // Внутреннее свечение янтарного кабошона: тёплое ядро, каустические прожилки
         // смолы и золотистый кант у оправы, затухающий к нулю при uAmber == 0.
         float ambAmt = clamp(uAmber, 0.0, 1.0);
         float ambGain = smoothstep(0.0, 0.55, ambAmt) * 0.78 + ambAmt * 0.52;
         vec2 ambP = (vLocalPos.xy - vec2(-0.0023, -0.9461)) / 0.218;
         float ambR = clamp(length(ambP), 0.0, 1.0);
         // Смещённая каустика снизу-справа (свет проходит сквозь толщу смолы)
         float ambCaustic = exp(-pow(length(ambP - vec2(0.22, 0.24)) * 1.45, 2.0));
         float ambCore = pow(max(0.0, 1.0 - ambR * ambR), 1.05);
         float ambRim = smoothstep(0.60, 0.96, ambR) * (1.0 - smoothstep(0.96, 1.02, ambR));
         float ambVein = rvNoise(ambP * 3.8 + vec2(1.7, 4.1)) * 0.65 + rvNoise(ambP * 8.5 - vec2(2.3, 0.9)) * 0.35;
         vec3 ambDeep = vec3(0.32, 0.055, 0.003);
         vec3 ambHoney = vec3(1.55, 0.42, 0.018);
         vec3 ambBezel = vec3(1.65, 0.76, 0.09);
         vec3 ambGlow = mix(ambDeep, ambHoney, clamp(ambCore * (0.55 + 0.55 * ambVein) + ambCaustic * 0.55, 0.0, 1.0)) + ambBezel * ambRim * 0.55;
         totalEmissiveRadiance += ambGlow * ambGain + uGlowColor * uRevealGlow * rvEdge * ambAmt;`
      )
      .replace(
        "#include <opaque_fragment>",
        `outgoingLight = outgoingLight / (1.0 + outgoingLight / vec3(1.25, 0.62, 0.24));
         #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => "reveal-amber-inset";
  return material;
}

/**
 * Приводит UV экструзии к мировым координатам знака, чтобы процедурные карты
 * шероховатости и микрорельефа ложились без растяжений SVG-масштаба.
 * @param {THREE.BufferGeometry} geo
 * @param {number} K
 */
function normalizeLogoUVs(geo, K) {
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");
  if (!pos || !uv) return;
  const tileScale = 1.15;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) * K;
    const wy = pos.getY(i) * K;
    const wz = pos.getZ(i) * K;
    const nz = nrm ? Math.abs(nrm.getZ(i)) : 1;
    // На лицевой грани — плоская развёртка (wx, wy); на фаске и боковине
    // добавляем z, чтобы микрошлифовка не тянулась полосами вдоль толщины.
    const u = (wx + (1 - nz) * wz * 0.85) * tileScale;
    const v = (wy + (1 - nz) * wz * 0.45) * tileScale;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}
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

    this.surfaceMaps = createGoldSurfaceMaps(256);
    this.medallionHole = findMedallionHole(this.parsed);

    this.material = patchRevealMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xc8962e,
        metalness: 1,
        roughness: 0.22,
        roughnessMap: this.surfaceMaps.roughnessMap,
        normalMap: this.surfaceMaps.normalMap,
        normalScale: new THREE.Vector2(0.038, 0.038),
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.25,
        emissive: 0x000000,
      }),
      true
    );
    this.amberInsetMaterial = patchAmberInsetMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0x3b1202,
        metalness: 0.0,
        roughness: 0.09,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 0.95,
        envMapIntensity: 0.48,
        emissive: 0x000000,
      })
    );
    this.depthMaterial = patchRevealDepth(
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    );

    this.mesh = null;
    this.amberInset = null;
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
    if (this.amberInset) {
      this.body.remove(this.amberInset);
      this.amberInset.geometry.dispose();
      this.amberInset = null;
    }
    const { shapes, K } = this.parsed;
    const depthSvg = Math.max(0.001, cfg.logo.depth / K);
    const bevelSvg = Math.max(0, cfg.logo.bevel / K);
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depthSvg,
      bevelEnabled: bevelSvg > 0,
      bevelThickness: bevelSvg,
      bevelSize: bevelSvg * LOGO_BEVEL_WIDTH_RATIO,
      bevelOffset: 0,
      bevelSegments: LOGO_BEVEL_SEGMENTS,
      curveSegments: 40,
    });
    geo.computeVertexNormals();
    // центрируем геометрию (x,y по bbox, z — по середине экструзии)
    geo.translate(-this.parsed.cx, -this.parsed.cy, -depthSvg / 2);
    normalizeLogoUVs(geo, K);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.body.add(this.mesh);

    // Янтарная вставка в окне оголовка циркуля: выпуклый кабошон внутри
    // золотой оправы, за внутренней эмблемой, поэтому золото знака остаётся сверху.
    if (this.medallionHole) {
      const { cx, cy, rx, ry } = this.medallionHole;
      const radius = Math.min(rx, ry) * 0.994;
      const insetGeo = new THREE.SphereGeometry(radius, 36, 20);
      const halfThick = Math.max(0.0005, depthSvg * 0.44);
      insetGeo.scale(rx / radius, ry / radius, halfThick / radius);
      insetGeo.translate(cx, cy, 0);
      this.amberInset = new THREE.Mesh(insetGeo, this.amberInsetMaterial);
      this.amberInset.castShadow = false;
      this.amberInset.customDepthMaterial = this.depthMaterial;
      this.body.add(this.amberInset);
    }

    this.depthSvg = depthSvg;
    this.frontZ = depthSvg / 2 + bevelSvg;
    // контур лежит на лицевой грани (поверх скоса)
    if (this.outline) this.outline.position.z = this.frontZ + 0.6 / K;
  }

  /**
   * Контур: ленты (quad-полоски) с шириной в пикселях.
   * Каждый отрезок — 4 вершины; толщина считается в экранном пространстве шейдером,
   * поэтому линия одинаково толстая на любом разрешении. Прорисовка управляется uniform uDraw.
   */
  buildOutline() {
    const { subPaths, cx, cy, W } = this.parsed;
    const STAGGER = 0.75; // сначала единый оголовок, затем остальные детали — без разрозненных штрихов
    const n = Math.max(1, subPaths.length);
    const segs = []; // [ax,ay,bx,by,t0,t1]
    subPaths.forEach((sp, i) => {
      const len = sp.getLength();
      const divs = Math.max(8, Math.ceil(len / (W / 500)));
      const pts = sp.getSpacedPoints(divs);
      const start = (i / n) * STAGGER;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        // без инверсии Y: отражение уже делает масштаб тела (body.scale.y = -K)
        segs.push([
          a.x - cx, a.y - cy, b.x - cx, b.y - cy,
          start + (k / (pts.length - 1)) * (1 - STAGGER),
          start + ((k + 1) / (pts.length - 1)) * (1 - STAGGER),
          i, k / (pts.length - 1), (k + 1) / (pts.length - 1),
        ]);
      }
    });
    const N = segs.length;
    this.outlineSegCount = N;
    // опорные точки контура — отсюда рождаются искры
    this.outlineAnchors = new Float32Array(segs.flatMap((s) => [s[0], s[1]]));
    const pos = new Float32Array(N * 12), other = new Float32Array(N * 12);
    const nb = new Float32Array(N * 12), endF = new Float32Array(N * 4);
    const side = new Float32Array(N * 4), tt = new Float32Array(N * 4);
    const part = new Float32Array(N * 4), pathT = new Float32Array(N * 4);
    const index = new Uint32Array(N * 6);
    segs.forEach(([ax, ay, bx, by, t0, t1, sub, path0, path1], s) => {
      const v = s * 4;
      // соседи в том же подконтуре: для стыков (miter join) лента не рвётся на сегментах
      const prev = s > 0 && segs[s - 1][6] === sub ? segs[s - 1] : null;
      const next = s < N - 1 && segs[s + 1][6] === sub ? segs[s + 1] : null;
      const nA = prev ? [prev[0], prev[1]] : [ax, ay];   // точка перед A
      const nB = next ? [next[2], next[3]] : [bx, by];   // точка после B
      // v0: A(-1) v1: A(+1) v2: B(-1) v3: B(+1)
      const ends = [
        [ax, ay, bx, by, -1, t0, nA, 0], [ax, ay, bx, by, 1, t0, nA, 0],
        [bx, by, ax, ay, -1, t1, nB, 1], [bx, by, ax, ay, 1, t1, nB, 1],
      ];
      ends.forEach(([px, py, ox, oy, sd, t, n, e], k) => {
        pos.set([px, py, 0], (v + k) * 3);
        other.set([ox, oy, 0], (v + k) * 3);
        nb.set([n[0], n[1], 0], (v + k) * 3);
        endF[v + k] = e;
        side[v + k] = sd;
        tt[v + k] = t;
        part[v + k] = sub === 0 ? 0 : 1;
        pathT[v + k] = e ? path1 : path0;
      });
      index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], s * 6);
    });
    this.outlineGeo = new THREE.BufferGeometry();
    this.outlineGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.outlineGeo.setAttribute("aOther", new THREE.BufferAttribute(other, 3));
    this.outlineGeo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    this.outlineGeo.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
    this.outlineGeo.setAttribute("aNb", new THREE.BufferAttribute(nb, 3));
    this.outlineGeo.setAttribute("aEnd", new THREE.BufferAttribute(endF, 1));
    this.outlineGeo.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
    this.outlineGeo.setAttribute("aPathT", new THREE.BufferAttribute(pathT, 1));
    this.outlineGeo.setIndex(new THREE.BufferAttribute(index, 1));
    this.outlineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.outlineU = {
      uRes: { value: new THREE.Vector2(OUTPUT.width, OUTPUT.height) },
      uDraw: { value: 0 },
      uReverse: { value: 0 },
      uRetire: { value: 0 },
    };
    this.outlineMat = makeRibbonMaterial(this.outlineU, 1.1, 1);
    this.outlineGlowMat = makeRibbonMaterial(this.outlineU, 4.5, 0.3);

    this.outline = new THREE.Group();
    const glow = new THREE.Mesh(this.outlineGeo, this.outlineGlowMat);
    const core = new THREE.Mesh(this.outlineGeo, this.outlineMat);
    glow.frustumCulled = core.frustumCulled = false;
    glow.renderOrder = core.renderOrder = 5;
    this.outline.add(glow, core);
    this.body.add(this.outline);
  }

  setResolution(w, h) {
    this.outlineU?.uRes.value.set(w, h);
  }

  /**
   * draw: 0..1 — сколько контура нарисовано;
   * opacity: видимость контура; fill: 0..1 — stroke-to-fill (контур сужается и уходит в золотую заливку).
   */
  updateOutline(draw, opacity, cfg, fill = 0, reverse = false) {
    this.outline.visible = cfg.logo.outlineEnabled && opacity > 0.001;
    if (!this.outline.visible) return;
    const u = this.outlineU;
    u.uDraw.value = draw;
    u.uReverse.value = reverse ? 1 : 0;
    u.uRetire.value = reverse ? 1 - draw : 0;
    const colCore = this._colCore = this._colCore || new THREE.Color();
    colCore.set(cfg.logo.outlineColor).lerp(new THREE.Color(cfg.colors.goldHighlight), fill * 0.6);
    const half = (cfg.logo.outlineWidthPx ?? 2.2) * 0.5 * (1 - 0.85 * fill);
    const core = this.outlineMat.uniforms;
    core.uWidth.value = half;
    core.uOpacity.value = cfg.logo.outlineOpacity * opacity * (1 - fill * 0.9);
    core.uColor.value.copy(colCore);
    const glow = this.outlineGlowMat.uniforms;
    glow.uWidth.value = half * 4.2;
    glow.uOpacity.value = (cfg.logo.outlineGlow ?? 0.35) * opacity * (1 - fill);
    glow.uColor.value.copy(colCore);
  }

  dispose() {
    this.outlineGeo?.dispose();
    this.outlineMat?.dispose();
    this.outlineGlowMat?.dispose();
    this.mesh?.geometry.dispose();
    this.amberInset?.geometry.dispose();
    this.surfaceMaps?.roughnessMap.dispose();
    this.surfaceMaps?.normalMap.dispose();
    this.material.dispose();
    this.amberInsetMaterial?.dispose();
    this.depthMaterial.dispose();
  }
}

const RIBBON_VS = /* glsl */ `
  attribute vec3 aOther;
  attribute vec3 aNb;      // соседняя точка контура у этого конца (для стыка)
  attribute float aEnd;    // 0 — конец A, 1 — конец B
  attribute float aSide;
  attribute float aT;
  attribute float aPart;   // первый подконтур — оголовок циркуля
  attribute float aPathT;  // прогресс внутри собственного подконтурa
  uniform vec2 uRes;
  uniform float uWidth;   // половина ширины в пикселях
  uniform float uDraw;
  uniform float uReverse;
  uniform float uRetire;
  varying float vSide;
  varying float vVis;
  varying float vHead;
  varying float vScreenY;
  void main(){
    vec4 cA = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreenY = cA.y / cA.w;
    vec4 cB = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
    vec4 cN = projectionMatrix * modelViewMatrix * vec4(aNb, 1.0);
    vec2 pA = cA.xy / cA.w * uRes * 0.5;
    vec2 pB = cB.xy / cB.w * uRes * 0.5;
    vec2 pN = cN.xy / cN.w * uRes * 0.5;
    // направление сегмента от этой точки к другому концу
    vec2 along = pB - pA;
    vec2 dA = length(along) > 1e-4 ? normalize(along) : vec2(1.0, 0.0);
    // направление к соседней точке (если соседа нет — совпадает с сегментом)
    vec2 toN = pN - pA;
    vec2 dN = length(toN) > 1e-4 ? normalize(toN) : dA;
    // касательная в стыке: вход + выход
    vec2 tang = aEnd > 0.5 ? (dN - dA) : (dA - dN);
    vec2 T = length(tang) > 1e-4 ? normalize(tang) : dA;
    vec2 nrm = vec2(-T.y, T.x);
    vec2 segN = vec2(-dA.y, dA.x);
    // миттер: компенсирует толщину на изломе, ограничен, чтобы не выстреливать
    float miter = clamp(1.0 / max(abs(dot(nrm, segN)), 0.5), 1.0, 2.0);
    vec2 offClip = nrm * aSide * uWidth * miter / (uRes * 0.5) * cA.w;
    gl_Position = vec4(cA.xy + offClip, cA.z, cA.w);
    vSide = aSide;
    float dv = uDraw - aT;
    float detailFade = 1.0 - smoothstep(0.05, 0.60, uRetire);
    float headRemain = 1.0 - smoothstep(0.27, 1.0, uRetire);
    // Уход собирает детали в единый оголовок, который отматывается последним.
    float lastLine = clamp((headRemain - aPathT) / 0.025, 0.0, 1.0);
    vVis = mix(clamp(dv / 0.012, 0.0, 1.0), mix(lastLine, detailFade, aPart), uReverse);
    float reverseHead = (1.0 - aPart) * exp(-pow((headRemain - aPathT) / 0.045, 2.0));
    vHead = mix(exp(-dv * dv / (0.025 * 0.025)), reverseHead, uReverse);
  }
`;

const RIBBON_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHeadColor;
  uniform float uOpacity;
  uniform float uCaptionSafe;
  varying float vSide;
  varying float vVis;
  varying float vHead;
  varying float vScreenY;
  void main(){
    float edge = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
    float a = edge * vVis * uOpacity;
    vec3 col = uColor * vVis + uHeadColor * vHead * vVis * 1.6;
    // Только для фоновых эхо: плавно освобождаем нижнюю область с титрами.
    float captionMask = mix(1.0, smoothstep(0.035, 0.13, vScreenY), uCaptionSafe);
    gl_FragColor = vec4(col, a * captionMask);
  }
`;

function makeRibbonMaterial(shared, widthMul, alphaMul) {
  return new THREE.ShaderMaterial({
    vertexShader: RIBBON_VS,
    fragmentShader: RIBBON_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRes: shared.uRes,
      uDraw: shared.uDraw,
      uReverse: shared.uReverse,
      uRetire: shared.uRetire,
      uWidth: { value: 1 * widthMul },
      uOpacity: { value: alphaMul },
      uCaptionSafe: { value: 0 },
      uColor: { value: new THREE.Color(0xffd98a) },
      uHeadColor: { value: new THREE.Color(1, 0.97, 0.85) },
    },
  });
}
