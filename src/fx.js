import { fabricTexture, fabricState } from './fabric-texture.js';
import { ringSidePosition, ringSideVisible, ringSideScale } from "./scenes/ring-sides.js";
import * as THREE from "three";
import { seededRandom } from "./random.js";
import { ringSweep } from "./timeline.js";

/* ─────────────────────────── Фон: свет из углов ─────────────────────────── */

const bgVS = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bgFS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uL;          // центр левого верхнего круга в NDC-подобных координатах
  uniform vec2 uR;          // центр правого нижнего круга
  uniform vec3 uBg;
  uniform vec3 uCL;
  uniform vec3 uCR;
  uniform float uSpread;
  uniform float uIntensity;
  uniform float uShimmer;
  uniform float uGrain;
  uniform float uVig;
  uniform float uLowerShade;
  uniform float uGrid;
  uniform float uEnvL;
  uniform float uEnvR;
  uniform float uRays;
  uniform float uFog;
  uniform float uBrushed;
  uniform float uFabricTexture;
  uniform sampler2D uFabricMap;
  uniform float uFabricReady;
  uniform float uIntroLight;
  uniform float uCinematic;
  uniform vec2 uIntroCenter;
  uniform float uUpperTime;
  uniform vec3 uUpperColor;

  // хеш без синусов и без разводов (Dave Hoskins) — чистое зерно без полос
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++){ v += a*noise(p); p = m*p; a *= 0.5; }
    return v;
  }

  // отблески воды: сетка каустик, переливается медленно
  float caustic(vec2 w, float t){
    vec2 c = w * vec2(3.2, 4.4);
    float a = sin(c.x + 1.3*sin(c.y*0.9 + t*0.35) + t*0.4);
    float b = sin(c.y*1.1 - 1.1*sin(c.x*0.8 - t*0.3) - t*0.25);
    return pow(0.5 + 0.5*a*b, 3.0);
  }

  void main(){
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);
    vec2 p = (vUv - 0.5) * 2.0 * asp;           // p.y ∈ [-1,1]
    float t = uTime;

    // жидкое переливание: domain warp шумом
    vec2 q = vec2(fbm(p*1.3 + vec2(0.0, t*0.05)), fbm(p*1.3 + vec2(5.2, -t*0.04)));
    vec2 w = p + (q - 0.5) * uShimmer * 0.9;

    float dl = length(w - uL);
    float dr = length(w - uR);
    float k = 1.35 / max(uSpread, 0.05);

    // концентрические волны, расходящиеся от кругов
    float wavesL = 0.5 + 0.5*sin(dl*16.0 - t*1.1);
    float wavesR = 0.5 + 0.5*sin(dr*16.0 - t*1.1 + 1.3);
    // рябь только у света: смещение узора каустик, круги и сетка не затрагиваются
    vec2 rip = vec2(sin(w.y * 11.0 + t * 0.9 + sin(w.x * 5.0 - t * 0.4)),
                    sin(w.x * 9.0 - t * 0.7 + sin(w.y * 6.0))) * 0.035;
    float causL = caustic(w - uL + rip, t), causR = caustic(w - uR + rip, t + 3.0);
    float fL = exp(-dl*k) * (0.72 + 0.28*wavesL*uShimmer) * (0.3 + 1.2*causL) * uEnvL;
    float fR = exp(-dr*k) * (0.72 + 0.28*wavesR*uShimmer) * (0.3 + 1.2*causR) * uEnvR;
    // «переливание»: медленное изменение яркости по шуму
    float flowL = 0.75 + 0.5*fbm(w*1.6 + vec2(t*0.08, 0.0));
    float flowR = 0.75 + 0.5*fbm(w*1.6 - vec2(t*0.07, 0.0) + 7.0);

    vec3 col = uBg;
    col += uCL * fL * flowL * uIntensity;
    col += uCR * fR * flowR * uIntensity;
    // дополнительный тонкий ореол вокруг самих кругов
    col += uCL * exp(-dl*dl*18.0) * 0.35 * uIntensity * uEnvL;
    col += uCR * exp(-dr*dr*18.0) * 0.35 * uIntensity * uEnvR;

    // объёмный туман: низкочастотный, подсвечивается кругами (без зерна)
    float fogN = fbm(w * 0.7 + vec2(t * 0.02, -t * 0.013));
    float fogMask = smoothstep(0.3, 0.85, fogN);
    float lightL = exp(-dl * 0.85) * uEnvL;
    float lightR = exp(-dr * 0.85) * uEnvR;
    col += (uCL * lightL + uCR * lightR) * fogMask * uFog * uIntensity;

    // световые лучи: радиальные полосы от каждого круга, медленно переливаются
    float angL = atan(w.y - uL.y, w.x - uL.x);
    float angR = atan(w.y - uR.y, w.x - uR.x);
    float raysL = pow(noise(vec2(angL * 9.0, t * 0.12)) * 0.7 + noise(vec2(angL * 23.0, t * 0.2)) * 0.3, 3.0);
    float raysR = pow(noise(vec2(angR * 9.0 + 4.0, t * 0.1)) * 0.7 + noise(vec2(angR * 23.0, t * 0.17)) * 0.3, 3.0);
    col += uCL * raysL * exp(-dl * 1.1) * uRays * uEnvL * uIntensity;
    col += uCR * raysR * exp(-dr * 1.1) * uRays * uEnvR * uIntensity;

    // архитектурная сетка (чертёжная), подсвечивается светом
    vec2 gp = w * 6.0;
    vec2 gg = abs(fract(gp - 0.5) - 0.5) / max(fwidth(gp), vec2(1e-4));
    float line = 1.0 - clamp(min(gg.x, gg.y), 0.0, 1.0);
    float lit = clamp(fL + fR, 0.0, 1.0);
    col += mix(uBg, uCL, 0.5) * line * uGrid * (0.15 + lit);

    // Мягкое затемнение центра: раньше оно срезало 55% яркости и вместе
    // с виньеткой превращало фон в коричневый туман.
    float edge = smoothstep(0.2, 1.0, length(p * vec2(0.62, 0.95)));
    col = mix(col * 0.74, col, edge);

    // Матовый графитовый камень: мягкая неоднородность и мелкая неподвижная
    // зернистость. Ноль выключает слой; картинка содержит только фактуру.
    if (uFabricTexture > 0.001) {
      float cloudy = noise(p * 3.2) * 0.5 + noise(p * 8.0) * 0.5;
      float fine = (hash(floor(vUv * uRes)) - 0.5) * 0.0024;
      vec3 stone = texture2D(uFabricMap, vUv).rgb;
      vec3 fallback = vec3(0.72, 0.76, 0.82) * (0.012 + 0.010 * cloudy);
      // В кинематографичном режиме слегка очищаем область титров,
      // не удаляя каменную фактуру и не затрагивая остальные режимы.
      float captionZone = exp(-pow((vUv.x - 0.5) / 0.38, 4.0) - pow((vUv.y - 0.31) / 0.20, 4.0));
      float stoneStrength = 1.0 - 0.25 * uCinematic * captionZone;
      col += (fallback + stone * (0.48 * uFabricReady) + vec3(fine)) * uFabricTexture * stoneStrength;
    }

    // Верхний объёмный свет за знаком работает во всех сценах.
    // Экранная маска мягко освобождает нижнюю зону для надписей.
    if (uIntroLight > 0.001) {
      vec2 screen = (gl_FragCoord.xy / uRes - 0.5) * 2.0 * asp;
      vec2 h = screen - uIntroCenter;
      float radius = length(h);
      float angle = atan(h.y, h.x);
      // Нерегулярные лучи больше похожи на объёмный свет, чем на геометрическую звезду.
      float ut = uUpperTime;
      float warpedAngle = angle + 0.14 * sin(angle * 3.0 + 0.8) + 0.04 * sin(ut * 0.21);
      float ray1 = pow(0.5 + 0.5 * cos(warpedAngle * 7.0 + 0.2 * sin(radius * 2.0) - 0.20 * sin(ut * 0.13)), 8.0);
      float ray2 = pow(0.5 + 0.5 * cos(warpedAngle * 12.0 - 0.4 + 0.24 * sin(ut * 0.11 + 1.0)), 11.0);
      float mist = 0.65 + 0.35 * noise(h * 3.0 + vec2(0.25 * sin(ut * 0.10), 0.0));
      float rays = (0.62 * ray1 + 0.28 * ray2) * smoothstep(0.10, 0.35, radius) * exp(-radius) * mist;
      // Ореол гаснет радиально без обрезающей полосы; только лучи
      // мягко ослабляются ниже центра, освобождая место для титров.
      float halo = exp(-radius * radius * 2.4);
      float clearCaption = smoothstep(-0.55, 0.40, h.y);
      float lightField = 0.14 * halo + 0.50 * rays * clearCaption;
      if (uCinematic > 0.5) {
        // Несколько широких световых пятен вместо симметричной звезды.
        // Локальные координаты привязаны к знаку, время — абсолютное.
        float y = max(h.y, 0.0);
        float spread = 0.085 + 0.11 * y;
        float drift = 0.035 * sin(ut * 0.21);
        float a = (h.x + 0.46 * y - drift) / spread;
        float b = (h.x - 0.13 * y + 0.14 + drift * 0.5) / (spread * 1.35);
        float c = (h.x - 0.58 * y - 0.08) / (spread * 0.9);
        float shafts = 0.58 * exp(-a*a*1.7) + 0.33 * exp(-b*b*1.4) + 0.24 * exp(-c*c*1.7);
        float atmosphere = 0.72 + 0.28 * noise(h * 2.2 + vec2(sin(ut * 0.08) * 0.2, 0.0));
        float upper = smoothstep(-0.08, 0.22, h.y) * exp(-y * 0.85);
        lightField = 0.075 * halo + 0.32 * shafts * atmosphere * upper + 0.045 * rays * clearCaption;
      }
      col += uUpperColor * uIntensity * uIntroLight * lightField;
    }

    // виньетка
    float vig = 1.0 - uVig * dot(p*0.45, p*0.45);
    col *= clamp(vig, 0.0, 1.0);
    // затемнение нижнего левого угла (диагональный градиент)
    float lowerLeft = smoothstep(0.1, 1.6, (-p.x - p.y) * 0.5 + 0.5);
    col *= 1.0 - uLowerShade * lowerLeft;

    // тонкая диагональная текстура (как в референсе), видна там, где есть свет
    float brush = sin((gl_FragCoord.x * 0.7 - gl_FragCoord.y) * 0.55);
    col *= 1.0 + uBrushed * 0.05 * brush * (0.3 + fL + fR);

    // зерно плёнки
    col += (hash(vUv*uRes + fract(t)*117.0) - 0.5) * uGrain;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

export class Background {
  constructor() {
    this.uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uL: { value: new THREE.Vector2(-0.8, 0.8) },
      uR: { value: new THREE.Vector2(0.8, -0.8) },
      uBg: { value: new THREE.Color() },
      uCL: { value: new THREE.Color() },
      uCR: { value: new THREE.Color() },
      uSpread: { value: 1 },
      uIntensity: { value: 0.9 },
      uShimmer: { value: 0.55 },
      uGrain: { value: 0.035 },
      uVig: { value: 0.55 },
      uLowerShade: { value: 0.45 },
      uGrid: { value: 0.05 },
      uEnvL: { value: 1 },
      uEnvR: { value: 1 },
      uRays: { value: 0.35 },
      uFog: { value: 0.6 },
      uBrushed: { value: 0.35 },
      uFabricTexture: { value: 0 },
      uFabricMap: { value: fabricTexture },
      uFabricReady: { value: 0 },
      uIntroLight: { value: 0 },
      uCinematic: { value: 0 },
      uIntroCenter: { value: new THREE.Vector2(0, 0.4) },
      uUpperTime: { value: 0 },
      uUpperColor: { value: new THREE.Color(0xffd98a) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: bgVS,
      fragmentShader: bgFS,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(t, cfg) {
    const u = this.uniforms;
    u.uTime.value = t;
    u.uBg.value.set(cfg.colors.background);
    u.uCL.value.set(cfg.colors.lightLeft);
    u.uCR.value.set(cfg.colors.lightRight);
    u.uSpread.value = cfg.background.lightSpread;
    u.uIntensity.value = cfg.background.lightIntensity;
    u.uShimmer.value = cfg.background.shimmer;
    u.uGrain.value = cfg.background.grainEnabled === false ? 0 : cfg.background.grain;
    u.uVig.value = cfg.background.vignetteEnabled === false ? 0 : cfg.background.vignette;
    u.uLowerShade.value = cfg.background.lowerShadeEnabled === false ? 0 : (cfg.background.lowerShade ?? 0.45);
    u.uGrid.value = cfg.background.gridEnabled === false ? 0 : (cfg.background.gridOpacity ?? 0.05);
    u.uRays.value = cfg.background.godRaysEnabled === false ? 0 : (cfg.background.godRays ?? 0.35);
    u.uFog.value = cfg.background.fogEnabled === false ? 0 : (cfg.background.fog ?? 0.6);
    u.uBrushed.value = cfg.background.brushedEnabled === false ? 0 : (cfg.background.brushed ?? 0.35);
    u.uFabricTexture.value = Math.max(0, Math.min(1, cfg.background.fabricTexture ?? 0));
    u.uFabricReady.value = fabricState.ready ? 1 : 0;
  }
}

/* ─────────────────────────── Кольца в углах ─────────────────────────── */

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.12)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Corners {
  constructor() {
    this.group = new THREE.Group();
    this.glowTex = makeGlowTexture();
    // Две группы колец: слева сверху и справа снизу — как в исходной сцене.
    this.sides = {
      left: this._makeSide("left"),
      right: this._makeSide("right"),
    };
    this.sig = "";
    this.matCount = 0;
    // разметка циркулем: пунктирная окружность и «ножка» — плоские, в плоскости фона
    this.constMat = new THREE.LineDashedMaterial({
      color: 0xe0b25a, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.3,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pivotMat = new THREE.MeshBasicMaterial({ color: 0xffe2a6, transparent: true, opacity: 0.9, depthWrite: false });
    // центральная разметка циркулем: тонкая пунктирная окружность за логотипом, медленно вращается
    const cpts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      cpts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    this.centerMat = new THREE.LineDashedMaterial({
      color: 0xe0b25a, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.18,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.centerRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cpts), this.centerMat);
    this.centerRing.computeLineDistances();
    this.group.add(this.centerRing);
    this.tickMat = new THREE.MeshBasicMaterial({
      color: 0xe0b25a, transparent: true, opacity: 0.8, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.sprites = {};
    this.lights = {};
    for (const side of ["left", "right"]) {
      const s = this.sides[side];
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xffb55c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8,
      }));
      sprite.position.z = -0.2;
      s.group.add(sprite);
      this.sprites[side] = sprite;
      const light = new THREE.PointLight(0xffb55c, 3, 14, 2);
      light.position.z = 1.2;
      s.group.add(light);
      this.lights[side] = light;
      this.group.add(s.group);
    }
  }

  _makeSide(side) {
    return { group: new THREE.Group(), layers: [], ticks: null, construction: null, pivot: null, side };
  }

  /** Плоское кольцо, которое «рисуется» дугой: u.value (0..1) — доля окружности, видимая от 0 до 1. */
  _ringMat(color) {
    const u = { value: 1 };
    const id = this.matCount++;
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSweep = u;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vAng;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAng = atan(position.y, position.x);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vAng;\nuniform float uSweep;")
        .replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\n" +
          "float aN = mod(vAng + 6.2831853, 6.2831853) / 6.2831853;\n" +
          "if (uSweep < 0.999 && aN > uSweep) discard;\n" +
          "float head = (uSweep < 0.999) ? (1.0 - smoothstep(0.0, 0.03, uSweep - aN)) : 0.0;"
        )
        .replace("#include <opaque_fragment>", "outgoingLight *= 1.0 + 2.0 * head;\n#include <opaque_fragment>");
    };
    m.customProgramCacheKey = () => "corner-ring-" + id;
    return { mat: m, u };
  }

  rebuild(cfg) {
    const sig = [cfg.rings.radius, cfg.rings.thickness, cfg.rings.layers].join("|");
    if (sig === this.sig) return;
    this.sig = sig;
    for (const side of ["left", "right"]) {
      const s = this.sides[side];
      for (const l of s.layers) { s.group.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.material.dispose(); }
      if (s.ticks) { s.group.remove(s.ticks); s.ticks.geometry.dispose(); s.ticks = null; }
      if (s.construction) { s.group.remove(s.construction); s.construction.geometry.dispose(); }
      if (s.pivot) { s.group.remove(s.pivot); s.pivot.geometry.dispose(); }
      s.layers = [];
      const layers = Math.round(cfg.rings.layers);
      for (let i = 0; i < layers; i++) {
        const r = cfg.rings.radius * (1 + i * 0.14);
        const tube = cfg.rings.thickness * (i === 0 ? 1.2 : 0.7);
        const geo = new THREE.RingGeometry(r - tube * 0.5, r + tube * 0.5, 256, 1);
        const { mat, u } = this._ringMat(0xe0b25a);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = 0;
        s.group.add(mesh);
        s.layers.push({ mesh, u, idx: i });
      }
      // архитектурные риски на внешнем кольце — плоские штрихи
      const tickCount = 96;
      const tickGeo = new THREE.PlaneGeometry(cfg.rings.thickness * 0.8, cfg.rings.radius * 0.07);
      const ticks = new THREE.InstancedMesh(tickGeo, this.tickMat, tickCount);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < tickCount; i++) {
        const a = (i / tickCount) * Math.PI * 2;
        const major = i % 8 === 0 ? 1.8 : 1;
        sc.set(1, major, 1);
        p.set(Math.cos(a) * cfg.rings.radius * 1.03, Math.sin(a) * cfg.rings.radius * 1.03, 0);
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
        m.compose(p, q, sc);
        ticks.setMatrixAt(i, m);
      }
      ticks.instanceMatrix.needsUpdate = true;
      s.ticks = ticks;
      s.group.add(ticks);
      // разметка циркулем: пунктирная окружность в плоскости фона + ножка в центре
      const pts = [];
      for (let i = 0; i <= 192; i++) {
        const a = (i / 192) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * cfg.rings.radius * 1.5, Math.sin(a) * cfg.rings.radius * 1.5, -0.05));
      }
      const construction = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.constMat);
      construction.computeLineDistances();
      s.construction = construction;
      s.group.add(construction);
      const pivot = new THREE.Mesh(new THREE.CircleGeometry(cfg.rings.radius * 0.03, 24), this.pivotMat);
      pivot.position.z = 0.02;
      s.pivot = pivot;
      s.group.add(pivot);
    }
  }

  /**
   * @param {number} halfW, halfH — полуразмеры видимой области на z=0
   */
  update(t, cfg, halfW, halfH, env = 1, focus = 0, sideEnvelopes = null) {
    this.rebuild(cfg);
    this.group.visible = cfg.rings.enabled;
    const sides = {
      left: { ...ringSidePosition("left", cfg.rings, halfW, halfH), dir: 1 },
      right: { ...ringSidePosition("right", cfg.rings, halfW, halfH), dir: -1 },
      // Малые группы чуть отведены от кромки, чтобы читались целиком.
    };
    const sp = cfg.rings.speed;
    const ringCol = new THREE.Color(cfg.colors.gold).multiplyScalar(0.8 + 0.3 * cfg.rings.glowIntensity);
    const cOp = (cfg.rings.constructionOpacity ?? 0.3) * env * (1 - 0.52 * focus);
    this.constMat.opacity = cOp;
    this.pivotMat.opacity = Math.min(1, 0.9 * env * (1 - 0.35 * focus));
    // центральный круг: позиция и размер от логотипа, вращение медленное, в плоскости фона
    const cr = this.centerRing;
    cr.visible = cfg.rings.enabled && env > 0.0005;
    cr.position.set(cfg.logo.offsetX ?? 0, cfg.logo.offsetY ?? 0, -0.05);
    cr.rotation.z = t * 0.04;
    cr.scale.setScalar(cfg.rings.radius * (0.8 - 0.06 * focus));
    this.centerMat.opacity = 0.18 * env * (1 - 0.67 * focus);
    this.tickMat.opacity = 0.8 * env * (1 - 0.2 * focus);
    for (const name of ["left", "right"]) {
      const s = this.sides[name];
      const c = sides[name];
      const sideEnv = sideEnvelopes?.[name] ?? env;
      s.group.position.set(c.x, c.y, 0);
      s.group.visible = cfg.rings.enabled && ringSideVisible(cfg.rings, name) && sideEnv > 0.0005;
      s.group.scale.setScalar(ringSideScale(cfg.rings, name));
      // кольца рисуются дугой из плоскости фона: появление и уход — через проход дуги, без масштаба
      s.layers.forEach((l) => {
        l.mesh.material.color.copy(ringCol);
        l.u.value = ringSweep(sideEnv, l.idx);
        l.mesh.material.opacity = 1 - 0.38 * focus;
      });
      // Риски и пунктир не должны заранее выдавать уже замкнутый круг:
      // отрисовываем только построенный сектор, как у основных дуг.
      const construction = ringSweep(sideEnv, 0);
      if (s.ticks) {
        s.ticks.count = Math.ceil(96 * construction);
        s.ticks.rotation.set(0, 0, t * sp * 0.2 * c.dir);
      }
      s.construction?.geometry.setDrawRange(0, Math.ceil(193 * construction));

      const flick = 1 + cfg.rings.flicker * (Math.sin(t * 1.8 + (name === "left" ? 0 : 2.1)) * 0.5 + Math.sin(t * 0.75 + 4.0) * 0.5);
      const lightCol = name === "left" ? cfg.colors.lightLeft : cfg.colors.lightRight;
      const intensity = cfg.rings.lightStrength * flick * 6 * cfg.lights.exposure * sideEnv * (1 - 0.55 * focus);
      const light = this.lights[name];
      light.color.set(lightCol);
      light.intensity = intensity;
      light.distance = 10 + cfg.background.lightSpread * 4;
      const sprite = this.sprites[name];
      sprite.material.color.set(lightCol);
      sprite.material.opacity = Math.min(1, 0.45 * cfg.rings.glowIntensity * flick) * sideEnv * (1 - 0.50 * focus);
      sprite.scale.setScalar(cfg.rings.radius * 4.2 * cfg.background.lightSpread);
    }
    return { left: this.sides.left.group.position, right: this.sides.right.group.position };
  }

  get positions() {
    return { left: this.sides.left.group.position, right: this.sides.right.group.position };
  }
}

/* ─────────────────────────── Частицы ─────────────────────────── */

const ptVS = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSpread;
  uniform float uSize;
  uniform float uRadius;
  uniform float uTilt;
  uniform float uPixel;
  uniform float uBright;
  uniform float uMode;      // 0 — орбиты вокруг кругов, 1 — пыль
  uniform vec3 uCenter;
  uniform vec2 uBox;        // полуразмеры области для пыли
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec2 uCornL;
  uniform vec2 uCornR;
  uniform float uRayLift;
  uniform float uCornStrengthL;
  uniform float uCornStrengthR;
  varying float vA;
  varying vec3 vC;
  void main(){
    float dir = aSeed.w > 0.5 ? 1.0 : -1.0;
    vec3 p;
    if (uMode < 0.5) {
      float a = aSeed.x * 6.28318 + uTime * uSpeed * (0.12 + aSeed.z * 0.55) * dir;
      float r = uRadius * (1.0 + (aSeed.y - 0.5) * 0.9 * uSpread);
      float wob = sin(uTime * 0.9 + aSeed.x * 40.0) * 0.07 * uSpread;
      p = vec3(cos(a) * r, sin(a) * r, wob * 0.3);
      p += uCenter;
    } else {
      float y = fract(aSeed.y + uTime * uSpeed * 0.015 * (0.3 + aSeed.z));
      p = vec3((aSeed.x - 0.5) * 2.0 * uBox.x * 1.05, (y - 0.5) * 2.0 * uBox.y * 1.05, -0.4 + aSeed.z * 0.3);
      p.x += sin(uTime * 0.25 + aSeed.w * 30.0) * 0.25;
    }
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = uSize * (0.5 + aSeed.z * 1.5);
    gl_PointSize = sz * uPixel / max(-mv.z, 0.1);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed.x * 3.5) + aSeed.y * 30.0);
    vA = tw * uBright * (0.3 + 0.7 * aSeed.z);
    vC = mix(uColA, uColB, aSeed.y);
    if (uMode > 0.5) {
      // пыль, подсвеченная световыми лучами от кругов
      vec2 q = p.xy / uBox.y;
      vA *= 1.0 + uRayLift * 2.0 * (uCornStrengthL * exp(-length(q - uCornL) * 1.1) + uCornStrengthR * exp(-length(q - uCornR) * 1.1));
    }
  }
`;

const ptFS = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float glow = core * core * core + core * 0.25;
    gl_FragColor = vec4(vC * vA, glow);
  }
`;

function particleGeometry(count, seedValue) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const rnd = seededRandom(seedValue);
  for (let i = 0; i < count; i++) {
    seed.set([rnd(), rnd(), rnd(), rnd() > 0.5 ? 1 : 0], i * 4);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  return geo;
}

export class Particles {
  constructor() {
    this.group = new THREE.Group();
    this.sig = "";
    this.left = null;
    this.right = null;
    this.dust = null;
    this.mats = [];
  }

  _mat(mode) {
    const m = new THREE.ShaderMaterial({
      vertexShader: ptVS,
      fragmentShader: ptFS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSpeed: { value: 0.5 }, uSpread: { value: 1 }, uSize: { value: 1 },
        uRadius: { value: 1.6 }, uTilt: { value: 1 }, uPixel: { value: 60 }, uBright: { value: 1 },
        uMode: { value: mode }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector2(3, 2) },
        uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
        uCornL: { value: new THREE.Vector2() }, uCornR: { value: new THREE.Vector2() }, uRayLift: { value: 0 },
        uCornStrengthL: { value: 1 }, uCornStrengthR: { value: 1 },
      },
    });
    this.mats.push(m);
    return m;
  }

  rebuild(cfg) {
    const sig = [cfg.particles.count, cfg.particles.dust].join("|");
    if (sig === this.sig) return;
    this.sig = sig;
    for (const key of ["left", "right", "dust"]) {
      if (this[key]) {
        this.group.remove(this[key]);
        this[key].geometry.dispose();
        this[key] = null;
      }
    }
    const n = Math.max(0, Math.round(cfg.particles.count));
    if (n > 0) {
      this.left = new THREE.Points(particleGeometry(n, 0x1234abcd), this._mat(0));
      this.right = new THREE.Points(particleGeometry(n, 0x6789abcd), this._mat(0));
      this.left.frustumCulled = false;
      this.right.frustumCulled = false;
      this.group.add(this.left, this.right);
    }
    const d = Math.max(0, Math.round(cfg.particles.dust));
    if (d > 0) {
      this.dust = new THREE.Points(particleGeometry(d, 0xdef01234), this._mat(1));
      this.dust.frustumCulled = false;
      this.group.add(this.dust);
    }
  }

  update(t, cfg, halfW, halfH, pixelRatio, viewportH, fovRad, ringPos, ringRadius, tilt, env = 1) {
    this.rebuild(cfg);
    this.group.visible = cfg.particles.enabled;
    const pixel = (viewportH * pixelRatio) / (2 * Math.tan(fovRad / 2)) * 0.012;
    const colA = new THREE.Color(cfg.colors.gold);
    const colB = new THREE.Color(cfg.colors.goldHighlight);
    const pos = [this.left, this.right];
    const sides = ["left", "right"];
    const dir = [1, -1];
    pos.forEach((pts, i) => {
      if (!pts) return;
      const u = pts.material.uniforms;
      u.uTime.value = t;
      u.uSpeed.value = cfg.particles.speed;
      u.uSpread.value = cfg.particles.spread;
      u.uSize.value = cfg.particles.size * 1.3;
      pts.visible = ringSideVisible(cfg.rings, sides[i]);
      u.uRadius.value = ringRadius * 1.25 * ringSideScale(cfg.rings, sides[i]);
      u.uTilt.value = tilt;
      u.uPixel.value = pixel;
      u.uBright.value = cfg.particles.brightness * env;
      u.uCenter.value.copy(ringPos[sides[i]]);
      u.uColA.value.copy(colA);
      u.uColB.value.copy(colB);
    });
    if (this.dust) {
      const u = this.dust.material.uniforms;
      u.uTime.value = t;
      u.uSpeed.value = cfg.particles.speed;
      u.uSize.value = cfg.particles.size * 0.7;
      u.uPixel.value = pixel;
      u.uBright.value = cfg.particles.brightness * 0.8 * env;
      u.uBox.value.set(halfW, halfH);
      u.uRayLift.value = (cfg.particles.rayLift ?? 1.0) * env;
      u.uCornStrengthL.value = ringSideVisible(cfg.rings, "left") ? 1 : 0;
      u.uCornStrengthR.value = ringSideVisible(cfg.rings, "right") ? 1 : 0;
      u.uCornL.value.set(ringPos.left.x / halfH, ringPos.left.y / halfH);
      u.uCornR.value.set(ringPos.right.x / halfH, ringPos.right.y / halfH);
      u.uColA.value.copy(colA);
      u.uColB.value.copy(colB);
    }
  }

  dispose() {
    for (const k of ["left", "right", "dust"]) this[k]?.geometry.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}
