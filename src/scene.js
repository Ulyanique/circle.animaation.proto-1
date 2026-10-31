import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  DepthOfFieldEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Logo, revealUniforms } from "./logo.js";
import { Background, Corners, Particles } from "./fx.js";
import { Sparks, AnamorphicFlare } from "./sparks.js";

const FOV = 30;
const CAM_Z = 9;
const REVEAL_MAX = 2.9; // радиус проявления, покрывающий весь логотип
const TAU = Math.PI * 2;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * Вычисляет фазу цикла по времени.
 * Цикл: прорисовка контура → появление из тени → удержание → уход в тень → пауза.
 */
export function computePhase(t, tl) {
  const D = tl.drawDuration, E = tl.emergeDuration, H = tl.holdDuration;
  const F = tl.fadeDuration, R = tl.restDuration;
  const cycle = Math.max(0.1, D + E + H + F + R);
  let local = (t - tl.startDelay) % cycle;
  if (local < 0) local += cycle;

  let draw = 0, reveal = 0, outline = 0, fill = 0, glint = -1, emergeT = -1, name = "rest";
  if (local < D) {
    name = "draw";
    draw = easeInOutCubic(clamp01(local / Math.max(D, 1e-4)));
    outline = 1;
  } else if (local < D + E) {
    name = "emerge";
    const p = (local - D) / Math.max(E, 1e-4);
    draw = 1;
    reveal = easeInOutCubic(p);
    outline = 1 - smooth(0.25, 1.0, p);
    fill = easeInOutCubic(p);
  } else if (local < D + E + H) {
    name = "hold";
    draw = 1;
    reveal = 1;
    fill = 1;
    glint = (local - D - E) / Math.max(H, 1e-4);
  } else if (local < D + E + H + F) {
    name = "fade";
    const p = (local - D - E - H) / Math.max(F, 1e-4);
    reveal = 1 - easeInOutCubic(p);
    draw = 1;
  }
  // прогресс «удержания» для плавного увеличения (0 → 1 от появления до ухода)
  const grow = clamp01((local - D) / Math.max(E + H + F, 1e-4));
  // огибающая кругов/света: из пустоты в начале цикла, обратно в пустоту к паузе
  const RI = Math.max(0.05, tl.ringsIntro ?? 2.4);
  const introE = smooth(0, RI, local);
  const outroStart = D + E + H;
  const outroE = local < outroStart ? 1 : 1 - smooth(0, Math.max(F, 1e-4), local - outroStart);
  const rings = introE * outroE;
  // секунды от начала появления (для искр); -1 — вне интервала
  if (local >= D && local < D + E + H + F) emergeT = local - D;
  return { name, draw, reveal, outline, fill, glint, emergeT, grow, local, cycle, rings };
}

export class LogoScene {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // сглаживание делаем через composer (MSAA + SMAA)
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050403, 1);
    this.renderer.toneMapping = THREE.NoToneMapping; // тон-маппинг делает постобработка
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);

    // Окружение: студийный HDR-подобный env для реалистичных металлических бликов
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Фон и свет из углов
    this.background = new Background();
    this.scene.add(this.background.mesh);

    // Тень на задний план (ловит тень логотипа)
    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.7, transparent: true, depthWrite: false })
    );
    this.shadowPlane.position.z = -1.3;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    // Освещение
    this.keyLight = new THREE.SpotLight(0xfff1d6, 14, 0, 0.6, 0.9, 2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.blurSamples = 16;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 30;
    this.scene.add(this.keyLight, this.keyLight.target);

    // блик: точечный свет, который скользит по золоту во время удержания
    this.glintLight = new THREE.PointLight(0xfff0c8, 0, 0, 2);
    this.glintLight.position.set(0, 1, 2.2);
    this.scene.add(this.glintLight);

    this.fillLight = new THREE.DirectionalLight(0xffe2b0, 0.4);
    this.fillLight.position.set(4, 2, 6);
    this.scene.add(this.fillLight);

    // Логотип
    this.logo = new Logo();
    this.logo.root.position.set(0, 0, 0);
    this.scene.add(this.logo.root);

    // Кольца и частицы
    this.corners = new Corners();
    this.scene.add(this.corners.group);
    this.particles = new Particles();
    this.sparks = new Sparks(this.logo);
    this.flare = new AnamorphicFlare();
    this.scene.add(this.flare.mesh);
    // свечение сверху за логотипом (как в референсе)
    this.topLight = new THREE.PointLight(0xffe2a6, 0, 0, 2);
    this.topLight.position.set(0, 2.4, -0.8);
    this.scene.add(this.topLight);
    this.topGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.corners.glowTex, color: 0xffd98a, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.topGlow.position.set(0, 1.5, -0.6);
    this.topGlow.scale.setScalar(9);
    this.scene.add(this.topGlow);
    this.scene.add(this.particles.group);

    this._msaaSig = String(cfg.post.msaaSamples);
    this._setupComposer();
    this.resize();
    this.applyStatic();
  }

  _setupComposer() {
    const cfg = this.cfg;
    this.composer = new EffectComposer(this.renderer, {
      multisampling: cfg.post.msaaSamples,
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.dof = new DepthOfFieldEffect(this.camera, {
      focusDistance: CAM_Z,
      focusRange: 5.0,
      bokehScale: 2.0,
      resolutionScale: 1.0,
    });
    this.bloom = new BloomEffect({
      intensity: 1.0,
      luminanceThreshold: 0.7,
      luminanceSmoothing: 0.2,
      mipmapBlur: true,
      radius: 0.8,
    });
    this.chroma = new ChromaticAberrationEffect();
    this.vignette = new VignetteEffect({ darkness: 0.45, offset: 0.35 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA });

    this.composer.addPass(new EffectPass(this.camera, this.dof));
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.chroma, this.vignette, this.tone));
    this.composer.addPass(new EffectPass(this.camera, this.smaa));
  }

  resize() {
    // внутренний рендер фиксирован 1920×1080 (pixelRatio = 1); на экран кадр масштабируется с letterbox
    const RW = 1920, RH = 1080, ASPECT = RW / RH;
    const W = window.innerWidth, H = window.innerHeight;
    let cw = W, ch = W / ASPECT;
    if (ch > H) { ch = H; cw = H * ASPECT; }
    this.renderer.domElement.style.width = Math.round(cw) + "px";
    this.renderer.domElement.style.height = Math.round(ch) + "px";
    this._w = RW;
    this._h = RH;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RW, RH, false);
    const pr = 1;
    this.composer.setSize(RW, RH);
    this.camera.aspect = ASPECT;
    this.camera.updateProjectionMatrix();

    // полуразмеры видимой области на z=0
    this.halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z;
    this.halfW = this.halfH * this.camera.aspect;
    this.viewportH = RH;
    this.fovRad = THREE.MathUtils.degToRad(FOV);
    this.pixelRatio = pr;

    // фон на z = -3.5 покрывает экран
    const dz = CAM_Z + 3.5;
    const bgH = 2 * Math.tan(this.fovRad / 2) * dz;
    // запас по краям: камера слегка смещается при появлении
    this.background.mesh.scale.set((bgH * this.camera.aspect) / 2 * 1.3, bgH / 2 * 1.3, 1);
    this.background.mesh.position.z = -3.5;
    this.logo.setResolution(RW * pr, RH * pr);
  }

  /** Статичные вещи, которые не меняются каждый кадр (но могут меняться от настроек). */
  applyStatic() {
    const cfg = this.cfg;
    this.logo.rebuildIfNeeded(cfg);
    this.corners.rebuild(cfg);
    this.particles.rebuild(cfg);
    this.sparks.rebuild(cfg);
  }

  update(t, dt) {
    const cfg = this.cfg;
    const ph = computePhase(t, cfg.timeline);
    const TAUt = TAU;
    const exposure = cfg.lights.exposure;

    this.applyStatic();

    // MSAA задаётся при создании composer → пересоздаём при смене значения
    const msaaSig = String(cfg.post.msaaSamples);
    if (msaaSig !== this._msaaSig) {
      this._msaaSig = msaaSig;
      this.composer.dispose();
      this._setupComposer();
      this.composer.setSize(this._w, this._h);
    }

    // окружение
    this.scene.environment = cfg.lights.envEnabled ? this.envTexture : null;

    // логотип: материал
    const m = this.logo.material;
    m.color.set(cfg.colors.gold);
    m.emissive.set(0x000000);
    m.metalness = cfg.logo.metalness;
    m.roughness = cfg.logo.roughness;
    m.clearcoat = cfg.logo.clearcoat;
    m.envMapIntensity = cfg.logo.envIntensity * (cfg.lights.envEnabled ? 1 : 0) * exposure;
    // глубокий золотой оттенок в тенях через emissive
    m.emissive.set(cfg.colors.goldDeep).multiplyScalar(0.12);

    // проявление из тени
    revealUniforms.uReveal.value = ph.reveal * REVEAL_MAX;
    revealUniforms.uRevealNoise.value = cfg.logo.revealNoise;
    revealUniforms.uRevealGlow.value = cfg.logo.revealGlow * (ph.name === "emerge" || ph.name === "fade" ? 1.0 : 0.6);
    revealUniforms.uGlowColor.value.set(cfg.colors.glowColor);
    revealUniforms.uK.value = this.logo.parsed.K;

    // движение: пульсация + покачивание + плавное увеличение во время удержания
    const scaleGrow = THREE.MathUtils.lerp(cfg.logo.holdScaleFrom, cfg.logo.holdScaleTo, easeOutCubic(ph.grow));
    // частоты пульсации/покачивания кратны циклу → состояние логотипа периодично, шов бесшовный
    const quant = (f) => (f <= 0 ? 0 : Math.max(1, Math.round(f * ph.cycle)) / ph.cycle);
    const pulse = 1 + cfg.logo.pulseAmount * Math.sin(TAUt * quant(cfg.logo.pulseSpeed) * t);
    const z = -cfg.logo.shadowDepth * (1 - ph.reveal) * (1 - ph.reveal);
    const root = this.logo.root;
    root.position.set(0, Math.sin(TAUt * quant(cfg.logo.swaySpeed * 0.5) * t) * 0.02, z);
    root.scale.setScalar(cfg.logo.scale * scaleGrow * pulse * (0.55 + 0.45 * easeOutCubic(ph.reveal)));  // сначала контур в малом размере, затем логотип растёт
    root.rotation.set(
      Math.cos(TAUt * quant(cfg.logo.swaySpeed * 0.7) * t + 1.0) * cfg.logo.swayAmount * 0.6,
      Math.sin(TAUt * quant(cfg.logo.swaySpeed) * t) * cfg.logo.swayAmount,
      0
    );
    this.logo.updateOutline(ph.draw, ph.outline, cfg, ph.fill);

    // кольца, свет из углов
    const env = ph.rings;
    const cpos = this.corners.update(t, cfg, this.halfW, this.halfH, env);
    const tilt = THREE.MathUtils.degToRad(cfg.rings.tilt);
    this.particles.update(t, cfg, this.halfW, this.halfH, this.pixelRatio, this.viewportH, this.fovRad, cpos, cfg.rings.radius, tilt, env);
    this.background.update(t, cfg);
    this.background.uniforms.uEnvL.value = env;
    this.background.uniforms.uEnvR.value = env;

    // фон: координаты кругов в NDC-подобных единицах
    const bgU = this.background.uniforms;
    bgU.uRes.value.set(this.renderer.domElement.width, this.renderer.domElement.height);
    bgU.uL.value.set(cpos.left.x / this.halfH, cpos.left.y / this.halfH);
    bgU.uR.value.set(cpos.right.x / this.halfH, cpos.right.y / this.halfH);
    // пыль, подсвеченная лучами от кругов
    if (this.particles.dust) {
      const du = this.particles.dust.material.uniforms;
      du.uCornL.value.copy(bgU.uL.value);
      du.uCornR.value.copy(bgU.uR.value);
      du.uRayLift.value = cfg.particles.rayLift * env;
    }

    // ключевой свет и тени
    const a = THREE.MathUtils.degToRad(cfg.lights.keyAngle);
    this.keyLight.position.set(-Math.sin(a) * 6.5, 5.2, Math.cos(a) * 6.5);
    this.keyLight.intensity = cfg.lights.keyIntensity * 4 * exposure;
    this.keyLight.shadow.radius = cfg.lights.shadowSoftness;
    this.shadowPlane.material.opacity = cfg.lights.shadowOpacity;
    this.fillLight.intensity = cfg.lights.fillIntensity * exposure;
    // блик скользит слева направо за время удержания и гаснет по краям
    if (ph.glint >= 0 && ph.glint <= 1) {
      const g = ph.glint;
      const gx = THREE.MathUtils.lerp(-3.0, 3.0, g);
      const env = Math.sin(Math.PI * g);
      this.glintLight.position.set(gx, 1.1, 2.2);
      this.glintLight.intensity = cfg.logo.glint * 40 * env * exposure;
      // анаморфный блик вдоль блика
      this.flare.set(gx, cfg.post.anamorphic * env * cfg.logo.glint * 0.5, cfg.colors.goldHighlight, 1.1, 1.6);
    } else {
      this.glintLight.intensity = 0;
      // постоянная горизонтальная полоса на уровне верхнего кольца (как в референсе)
      this.flare.set(0, cfg.post.anamorphic * 0.5 * ph.reveal, cfg.colors.goldHighlight, 1.25, 2.6);
    }

    // камера слегка смещена при появлении и возвращается в фронтальный вид
    const camK = (1 - ph.reveal) * 0.6;
    this.camera.position.set(-0.6 * camK, 0.35 * camK, CAM_Z);
    this.camera.lookAt(0, 0, 0);

    // верхнее свечение: появляется вместе с логотипом
    this.topLight.intensity = cfg.lights.topGlow * ph.reveal * exposure;
    this.topGlow.material.opacity = Math.min(1, 0.6 * ph.reveal * cfg.lights.topGlow / 40);

    // искры при проявлении
    const pixel = (this.viewportH * this.pixelRatio) / (2 * Math.tan(this.fovRad / 2)) * 0.012;
    this.sparks.update(ph.emergeT, cfg, pixel, cfg.timeline.emergeDuration * 0.8);

    // постобработка
    this._applyPost(ph, cfg, t);
  }

  _applyPost(ph, cfg, t) {
    const p = cfg.post;
    this.smaa.blendMode.opacity.value = p.smaa ? 1 : 0;
    this.dof.blendMode.opacity.value = p.dofEnabled ? 1 : 0;
    // размытие уходит в ноль, пока проявляется логотип (контур в начале остаётся чётким)
    this.dof.bokehScale = p.dofBokeh + p.dofStartBlur * 0.35 * (1 - ph.reveal);
    this.dof.circleOfConfusionMaterial.focusDistance = CAM_Z + p.dofFocusDistance;
    this.bloom.intensity = p.bloomIntensity;
    this.bloom.luminanceMaterial.threshold = p.bloomThreshold;
    this.bloom.radius = p.bloomRadius;
    this.chroma.offset.set(p.chromaticAberration, p.chromaticAberration);
  }

  render(dt) {
    this.composer.render(dt);
  }

  dispose() {
    this.logo.dispose();
    this.particles.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
