import { metallicTitleCSS, titleGlintAtGlyph } from "./caption-material.js";
import { ConstructionGuides } from "./construction-guides.js";
import { logoRotation } from "./scenes/logo-motion.js";
import { updateTopIllumination, updateUpperRays } from "./top-illumination.js";
import { ringSideVisible } from "./scenes/ring-sides.js";
import { logoTimingPhase } from "./logo-timing.js";
import { captionTimedLine } from "./caption-timing.js";
import { customTextAnimation, customTextVisual } from "./custom-text.js";
import { applyEffectOrder } from "./effect-order.js";
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  ShaderPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  DepthOfFieldEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { createStudioEnvironment } from "./studio-environment.js";
import { masterSize, masterId } from "./output-profile.js";
import { applyQualityPreset, qualityPostOverrides, suggestedQuality, parallaxAmount, DEFAULT_QUALITY, isQualityPreset } from "./quality-presets.js";

/**
 * MSAA выбранного пресета: пресет может только выключать сэмплы, но не
 * добавлять их сверх авторской настройки сцены.
 * @param {any} post
 * @param {string} qualityId
 */
function effectiveMsaa(post, qualityId) {
  return Math.min(Number(post.msaaSamples) || 0, qualityPostOverrides(qualityId).msaaSamples);
}
import { DitherEffect } from "./dither-effect.js";
import { CaptionLayer, CAPTION_SHADER } from "./caption-layer.js";
import { BACKGROUND_GLOW_IDS } from "./background-glow-config.js";
import { BackgroundGlow } from "./background-glow.js";
import { PARTICLE_CLOUD_IDS } from "./particle-cloud-config.js";
import { ParticleCloud } from "./particle-cloud.js";
import { DECOR_SLOTS } from "./brand-decor-config.js";
import { BrandDecor } from "./brand-decor.js";
import { Logo, revealUniforms } from "./logo.js";
import { ContourWaves } from "./contour-waves.js";
import { Background, Corners, Particles } from "./fx.js";
import { Sparks, AnamorphicFlare, flarePosition } from "./sparks.js";
import { Plotter } from "./plotter.js";
import { SolarBokeh } from "./bokeh.js";
import { captionState, finaleCaptionState, captionAccent, glyphReveal } from "./caption.js";
import { captionDrift, introTitleLanding } from "./caption-layout.js";
import { computePhase, compositionFocus, heroGlint, holdGlint, seamCurtainOpacity, layerParallax, logoDrawFinish } from "./timeline.js";
import { introCues, introSequence, introOutro, introCornerEnvelopes, finaleCues } from "./scenes/cues.js";

const FOV = 30;
const CAM_Z = 9;
const REVEAL_MAX = 2.9; // радиус проявления, покрывающий весь логотип
const TAU = Math.PI * 2;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
// Не переписываем сотни неизменившихся CSS-свойств на каждом кадре удержания.
const setStyleIfChanged = (el, name, value) => {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
};

export { computePhase } from "./timeline.js";

export class LogoScene {
  constructor(canvas, cfg, { intro = true, contourWaves = false, photoSpin = false, introStyle = false } = {}) {
    this.cfg = cfg;
    this.isIntro = intro;
    this.introStyle = intro || introStyle;
    this.photoSpin = photoSpin;
    this._introCenter = new THREE.Vector3();
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

    // Окружение: собственные софтбоксы под бренд, а не стандартная комната three.js.
    this.envTexture = createStudioEnvironment(this.renderer);

    // Фон и свет из углов
    this.background = new Background();
    this.scene.add(this.background.mesh);

    // Тень на задний план: близкая плоскость даёт мягкую контактную тень
    // прямо за знаком, а не далёкий силуэт сбоку, спорящий с титром.
    this.shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.7, transparent: true, depthWrite: false })
    );
    this.shadowPlane.position.z = -0.32;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    // Освещение
    this.keyLight = new THREE.SpotLight(0xffe0a8, 14, 0, 0.6, 0.9, 2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.blurSamples = 16;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 30;
    this.scene.add(this.keyLight, this.keyLight.target);

    // блик: точечный свет, который один раз скользит по золоту при сборке названия
    this.glintLight = new THREE.PointLight(0xffca78, 0, 0, 2);
    this.glintLight.position.set(0, 1, 2.2);


    this.fillLight = new THREE.DirectionalLight(0xffe2b0, 0.4);
    this.fillLight.position.set(4, 2, 6);
    this.scene.add(this.fillLight);

    // Логотип
    this.logo = new Logo();
    this.logo.root.position.set(0, 0, 0);
    this.scene.add(this.logo.root);
    this.logo.root.add(this.glintLight);
    // Построительная окружность — опциональный элемент любой сцены.
    this.brandDecors = Object.fromEntries(DECOR_SLOTS.map(({id, section}) => [id, new BrandDecor(section)]));
    for (const decor of Object.values(this.brandDecors)) this.scene.add(decor.group);
    this.brandDecor = this.brandDecors.brandDecor;
    this.particleClouds = Object.fromEntries(PARTICLE_CLOUD_IDS.map(id => [id, new ParticleCloud(id)]));
    for (const cloud of Object.values(this.particleClouds)) this.scene.add(cloud.group);
    this.particleCloud = this.particleClouds.particleCloud;
    // Волны включаются только сценой фотопаузы.
    this.contourWaves = contourWaves ? new ContourWaves(this.logo) : null;
    if (this.contourWaves) this.scene.add(this.contourWaves.group);

    // Кольца и частицы: только левый верх и правый низ, как в исходной сцене.
    this.corners = new Corners();
    this.scene.add(this.corners.group);
    this.backgroundGlows = Object.fromEntries(BACKGROUND_GLOW_IDS.map(id => [id, new BackgroundGlow(this.corners.glowTex, id)]));
    for (const glow of Object.values(this.backgroundGlows)) this.scene.add(glow.group);
    this.plotter = new Plotter(this.corners.glowTex, this.logo, { twoHeads: this.introStyle, finale: introStyle });
    this.scene.add(this.plotter.group);
    this.constructionGuides = new ConstructionGuides();
    this.scene.add(this.constructionGuides.group);
    this.solarBokeh = new SolarBokeh();
    this.scene.add(this.solarBokeh.group);
    this.particles = new Particles();
    this.sparks = new Sparks(this.logo);
    this.flare = new AnamorphicFlare();
    this.logo.root.add(this.flare.mesh);
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
    // Мягкая янтарная подсветка за знаком: тёплый акцент, который отделяет
    // металл от коричневого фона и напоминает о названии бренда.
    this.amberGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.corners.glowTex, color: 0xc06c1e, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0,
    }));
    this.amberGlow.position.set(0, 0.2, -0.7);
    this.amberGlow.scale.set(3.6, 3.6, 1);
    this.scene.add(this.amberGlow);
    this.scene.add(this.particles.group);

    // Полноэкранная заслонка внутри WebGL: одинаково действует на превью,
    // PNG-кадры и запись canvas (в отличие от DOM-оверлея).
    this.seamCurtain = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0,
        depthTest: false, depthWrite: false, toneMapped: false })
    );
    this.seamCurtain.position.z = CAM_Z - 0.6;
    this.seamCurtain.renderOrder = 1000;
    this.seamCurtain.frustumCulled = false;
    this.scene.add(this.seamCurtain);

    // Титр — отдельный проход композитора: общий тон, SMAA и дизеринг без
    // блума, аберрации и DoF, которые размывают буквы на большом экране.
    this.captionLayer = new CaptionLayer();
    this._captionVisible = true;
    this._captionOverride = false;
    this._captionSource = null;

    this._quality = suggestedQuality(masterId());
    this._msaaSig = String(effectiveMsaa(cfg.post, this._quality));
    this._setupComposer();
    this.resize();
    this.applyStatic();
  }

  _setupComposer() {
    const cfg = this.cfg;
    this.composer = new EffectComposer(this.renderer, {
      multisampling: effectiveMsaa(cfg.post, this._quality),
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
    this.vignette = new VignetteEffect({ darkness: 0.28, offset: 0.45 });
    // Финальный дизеринг: полосы на тёмных градиентах заметнее всего на большом экране.
    this.dither = new DitherEffect();
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA });

    this.captionPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null },
        uCaption: { value: this.captionLayer.texture },
        uOpacity: { value: 1 },
      },
      ...CAPTION_SHADER,
      depthTest: false,
      depthWrite: false,
    }));
    this.captionPass.enabled = false;

    this.composer.addPass(new EffectPass(this.camera, this.dof));
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.chroma, this.vignette));
    // Титр садится в кадр до тонмаппинга: тот же грейд, что у всего кадра.
    this.composer.addPass(this.captionPass);
    this.composer.addPass(new EffectPass(this.camera, this.tone));
    this.composer.addPass(new EffectPass(this.camera, this.smaa));
    this.composer.addPass(new EffectPass(this.camera, this.dither));
  }

  resize() {
    // Внутренний рендер следует профилю мастера (умолчание — 1920×1080),
    // на экран кадр масштабируется с letterbox.
    const { width: RW, height: RH } = masterSize();
    const ASPECT = RW / RH;
    // Внутренний рендер неизменен при перемещении и масштабе интерфейса.
    if (this._w !== RW || this._h !== RH) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(RW, RH, false);
      this.composer.setSize(RW, RH);
    }
    this._w = RW; this._h = RH;
    const pr = 1;
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
    this.plotter.setResolution?.(RW * pr, RH * pr);
    this.captionLayer.setSize(RW, RH);
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
    let ph = computePhase(t, cfg.timeline);
    const introExit = this.isIntro ? introOutro(ph, cfg.timeline) : null;
    if (introExit) ph = { ...ph, ...introExit };
    const finale = cfg.finale ? finaleCues(ph, cfg.timeline, cfg.finale) : null;
    // Состояние финальной последовательности доступно проверкам кадра.
    this._finaleState = finale;
    if (finale?.active && ph.name === "fade") {
      ph = { ...ph, reveal: finale.reveal, fill: finale.reveal, outline: finale.outline, draw: finale.draw };
    }
    const opening = this.introStyle && !finale?.active ? introCues(ph, cfg.timeline) : { beams: 0, strike: 0, approach: 0 };
    // Такт стартовой вспышки доступен проверкам кадра: uIntroLight принадлежит
    // общему слою верхних лучей и в фоновых сценах не равен нулю.
    this._openingBeams = opening.beams;
    const sequencePhase = finale?.active
      ? computePhase(cfg.timeline.startDelay + cfg.timeline.drawDuration + cfg.timeline.emergeDuration + cfg.timeline.holdDuration - 1e-6, cfg.timeline) : ph;
    const sequence = this.introStyle ? introSequence(sequencePhase, cfg.timeline, cfg.intro) : null;
    if (sequence && finale?.active) sequence.corners *= finale.corners;
    const TAUt = TAU;
    const exposure = cfg.lights.exposure;

    this.applyStatic();

    // MSAA задаётся при создании composer → пересоздаём при смене значения
    const msaaSig = String(effectiveMsaa(cfg.post, this._quality));
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
    const amberAmount = THREE.MathUtils.clamp(cfg.logo.amber ?? 0, 0, 1);
    if (this.logo.amberInset) {
      this.logo.amberInset.visible = amberAmount > 0.001;
      this.logo.amberInsetMaterial.envMapIntensity = 0.48 * (cfg.lights.envEnabled ? 1 : 0) * exposure;
    }

    // Изолируем собственный интервал знака от сценария света, фона и титров.
    const logoPhase = logoTimingPhase(t, cfg.timeline, cfg.logoTiming, ph);
    // проявление из тени
    revealUniforms.uReveal.value = logoPhase.reveal * REVEAL_MAX;
    revealUniforms.uRevealNoise.value = cfg.logo.revealNoise;
    revealUniforms.uFacetPolish.value = THREE.MathUtils.clamp(cfg.logo.facetPolish ?? 0, 0, 1);
    revealUniforms.uStudioRelief.value = THREE.MathUtils.clamp(cfg.logo.studioRelief ?? 0, 0, 1);
    revealUniforms.uCinematicGold.value = cfg.logo.cinematic === true ? 1 : 0;
    revealUniforms.uCinematicTime.value = t;
    revealUniforms.uRevealGlow.value = cfg.logo.revealGlow * (ph.name === "emerge" || ph.name === "fade" ? 1.0 : 0.6) *
      (1 + opening.strike * 0.55);
    revealUniforms.uGlowColor.value.set(cfg.colors.glowColor);
    revealUniforms.uK.value = this.logo.parsed.K;
    revealUniforms.uAmber.value = amberAmount;

    // движение: пульсация + покачивание + плавное увеличение во время удержания
    const scaleGrow = THREE.MathUtils.lerp(cfg.logo.holdScaleFrom, cfg.logo.holdScaleTo, easeOutCubic(ph.grow));
    // частоты пульсации/покачивания кратны циклу → состояние логотипа периодично, шов бесшовный
    const quant = (f) => (f <= 0 ? 0 : Math.max(1, Math.round(f * ph.cycle)) / ph.cycle);
    // Во время сборки и посадки знак не пульсирует: дыхание плавно
    // включается только после остановки и исчезает перед обратным движением.
    const directedMotion = this.isIntro && cfg.logo.directedMotion === true;
    const pulseWeight = directedMotion && sequence ? sequence.settled : 1;
    const pulse = 1 + cfg.logo.pulseAmount * pulseWeight * Math.sin(TAUt * quant(cfg.logo.pulseSpeed) * t);
    const retreat = finale?.active ? finale.retreat : 0;
    const z = -cfg.logo.shadowDepth * (1 - logoPhase.reveal) * (1 - logoPhase.reveal) - retreat * (cfg.finale?.retreatDepth ?? 0);
    const root = this.logo.root;
    root.visible = cfg.logo.visible !== false;
    const lift = sequence ? sequence.lift : 1;
    const sway = Math.sin(TAUt * quant(cfg.logo.swaySpeed * 0.5) * t) * 0.02;
    const y = (cfg.logo.offsetY ?? 0) * lift + sway * (sequence ? sequence.settled : 1);
    root.position.set((cfg.logo.offsetX ?? 0) * lift * (1 - (finale?.center ?? 0)), y * (1 - (finale?.center ?? 0)), z);
    const retreatScale = 1 - retreat * (1 - (cfg.finale?.retreatScale ?? 1));
    root.scale.setScalar(cfg.logo.scale * scaleGrow * pulse * (0.55 + 0.45 * easeOutCubic(logoPhase.reveal)) * retreatScale);  // сначала контур в малом размере, затем логотип растёт
    // Интро смотрит прямо, фотопауза поворачивает только знак, остальные сцены сохраняют покачивание.
    const rotation = logoRotation({intro: this.introStyle, photo: this.photoSpin, time: t, local: ph.local,
      cycle: ph.cycle, start: logoDrawFinish(cfg.timeline), turns: cfg.photo?.logoTurns, swayAmount: cfg.logo.swayAmount, swaySpeed: cfg.logo.swaySpeed});
    root.rotation.set(rotation.x, rotation.y, rotation.z);
    this.logo.updateOutline(logoPhase.draw, logoPhase.outline, cfg, logoPhase.fill, logoPhase.reverse);
    this.contourWaves?.update(t, ph, cfg);
    if (!root.visible && this.contourWaves) this.contourWaves.group.visible = false;

    // кольца, свет из углов
    // В интро боковые круги появляются только после собранного знака.
    const env = sequence ? sequence.corners : ph.rings;
    const focus = compositionFocus(ph, cfg.timeline, sequence?.captionStart);
    const cornerEnv = env * (1 - 0.44 * focus);
    const sideEnv = introCornerEnvelopes(env, directedMotion);
    const cpos = this.corners.update(t, cfg, this.halfW, this.halfH, env, focus, sideEnv);
    const cinematic = cfg.logo.cinematic === true;
    // Приглушаем только декоративные засветки, не меняя геометрию окружностей,
    // пользовательские настройки или свет, падающий на металл.
    if (cinematic) for (const sprite of Object.values(this.corners.sprites)) sprite.material.opacity *= 0.38;
    if (this.introStyle || this.hideCenterRing) this.corners.centerRing.visible = false;
    const effectPhase = computePhase(t, cfg.timeline);
    applyEffectOrder(cfg, this);
    this.constructionGuides.update(t, effectPhase, cfg, root, cpos, this.introStyle);
    for (const decor of Object.values(this.brandDecors)) decor.update(t, effectPhase, cfg, root);
    for (const cloud of Object.values(this.particleClouds)) cloud.update(t, effectPhase, cfg);
    for (const glow of Object.values(this.backgroundGlows)) glow.update(t, effectPhase, cfg);
    this.solarBokeh.update(t, sequence ? { ...ph, rings: env } : ph, cfg, cpos, focus);
    if (cinematic) for (const disc of this.solarBokeh.discs) disc.uniforms.uOpacity.value *= 0.45;
    this.plotter.update(ph, cfg, (sequence || finale?.active) ? root.position.y : cfg.logo.offsetY, root.position.x);
    const tilt = THREE.MathUtils.degToRad(cfg.rings.tilt);
    this.particles.update(t, cfg, this.halfW, this.halfH, this.pixelRatio, this.viewportH, this.fovRad, cpos, cfg.rings.radius, tilt, cornerEnv);
    if (directedMotion && this.particles.right) {
      this.particles.right.material.uniforms.uBright.value *= env > 1e-6 ? sideEnv.right / env : 0;
    }
    if (cinematic) for (const points of [this.particles.left, this.particles.right, this.particles.dust]) {
      if (points) points.material.uniforms.uBright.value *= 0.42;
    }
    // Параллакс слоёв: фон, кольца и пыль сдвигаются на 1–3 px относительно
    // знака. Знак и титр стоят на месте — глубина появляется без DOF.
    // Смещение периодично по циклу, поэтому шов не меняется.
    const par = layerParallax(t, cfg.timeline, parallaxAmount(cfg.camera?.parallax ?? 0, masterSize()));
    this.background.update(t, cfg);
    this.background.mesh.position.x = -par.x;
    this.background.mesh.position.y = -par.y;
    this.corners.group.position.set(par.x * 0.7, par.y * 0.7, 0);
    this.particles.group.position.set(par.x * 1.5, par.y * 1.5, 0);
    this.background.uniforms.uEnvL.value = cornerEnv * (cinematic ? 0.42 : 1) * (ringSideVisible(cfg.rings, "left") ? 1 : 0);
    this.background.uniforms.uEnvR.value = sideEnv.right * (1 - 0.44 * focus) * (cinematic ? 0.42 : 1) * (ringSideVisible(cfg.rings, "right") ? 1 : 0);
    updateUpperRays(this.background, ph, cfg, this.introStyle, opening.beams, t);
    // На удержании фон остаётся живым, но перестаёт спорить с названием.
    this.background.uniforms.uShimmer.value *= 1 - 0.32 * focus;
    this.background.uniforms.uRays.value *= 1 - 0.22 * focus;

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
      du.uRayLift.value = cfg.particles.rayLift * cornerEnv;
    }

    // ключевой свет и тени
    const a = THREE.MathUtils.degToRad(cfg.lights.keyAngle);
    this.keyLight.position.set(-Math.sin(a) * 6.5, 5.2, Math.cos(a) * 6.5);
    this.keyLight.intensity = cfg.lights.keyIntensity * 1.5 * exposure;
    this.keyLight.shadow.radius = cfg.lights.shadowSoftness;
    // Во вращении (фотопауза) ребро знака выдаётся назад до половины ширины;
    // отодвигаем плоскость тени за вылет поворота, чтобы она не рассекала знак.
    const yawBack = Math.abs(Math.sin(root.rotation.y)) * 1.65 * root.scale.x;
    this.shadowPlane.position.z = root.position.z - 0.30 - yawBack;
    this.shadowPlane.material.opacity = cfg.lights.shadowOpacity * logoPhase.reveal;
    this.fillLight.intensity = cfg.lights.fillIntensity * exposure;
    // Один короткий тёплый проход по граням, пока собирается название.
    // На удержании ключевой акцент — текст, а не бегущий по нему блик.
    const cue = heroGlint(ph, cfg.timeline, sequence?.captionStart);
    // На удержании металл не замирает: один медленный тёплый проход за цикл
    // (holdGlint) идёт в обратную сторону и вдвое слабее геройского. Окна
    // почти не пересекаются, а в пересечении интенсивности складываются и
    // позиция берётся средневзвешенной — полоса не телепортируется.
    const hold = holdGlint(ph, cfg.timeline);
    const glintSum = cue.intensity + hold.intensity;
    const glintIntensity = Math.min(1, glintSum);
    const glintPosition = glintSum > 1e-4
      ? (cue.position * cue.intensity + hold.position * hold.intensity) / glintSum
      : cue.position;
    revealUniforms.uSpecPass.value = cfg.logo.glint * 1.8 * glintIntensity;
    const gx = glintPosition * 1.6;
    revealUniforms.uSpecX.value = gx;
    this.glintLight.position.set(gx, -.665, 2.2);
    this.glintLight.intensity = cfg.logo.glint * 1.4 * glintIntensity * exposure;
    const edgeFlare = 4 * ph.reveal * (1 - ph.reveal);
    const flare = flarePosition(gx, cue.intensity);
    this.flare.set(flare.x, cfg.post.anamorphic * cfg.logo.glint * 0.20 * cue.intensity +
      cfg.post.anamorphic * (0.035 * edgeFlare + (directedMotion ? 0.15 : 0.10) * opening.strike), cfg.colors.goldHighlight, flare.y,
      1.2 + 2.0 * opening.strike, cfg.logo.depth / 2 + cfg.logo.bevel + .02);

    // Один и тот же t всегда даёт один и тот же кадр подписи, даже после seek.
    const capEl = document.getElementById("caption");
    if (capEl) {
      for (const name of ["title", "subtitle", "date"]) {
        setStyleIfChanged(capEl, `--${name}-offset-x`, `${(cfg.caption?.[`${name}X`] ?? 0) * 100}%`);
        setStyleIfChanged(capEl, `--${name}-offset-y`, `${(cfg.caption?.[`${name}Y`] ?? 0) * 100}%`);
      }
      const { progress, lines } = finale
        ? finaleCaptionState(t, cfg.timeline, sequence?.captionStart, cfg.finale)
        : captionState(t, cfg.timeline, sequence?.captionStart, this.isIntro ? 0.42 : 1);
      setStyleIfChanged(capEl, "--finale-subtitle-y", `${79 - 29 * (finale?.subtitleCenter ?? 0)}%`);
      const k = THREE.MathUtils.smoothstep(progress, 0.0, 0.8);
      capEl.style.setProperty("--drift", `${captionDrift(k, finale?.subtitleCenter ?? 0, parseFloat(capEl.style.height) || window.innerHeight).toFixed(3)}px`);
      capEl.style.transform = "translate(-50%, calc(-50% + var(--drift)))";
      const u = parseFloat(capEl.style.getPropertyValue("--u")) || 19.2;
      for (const [sel, name, baseLine] of [
        [".cap-title", "title", captionTimedLine(t, cfg.timeline, cfg.captionTiming, "title", lines.title)], [".r1", "rule1", lines.rule1],
        [".cap-sub", "subtitle", captionTimedLine(t, cfg.timeline, cfg.captionTiming, "subtitle", lines.subtitle)], [".r2", "rule2", lines.rule2],
        [".cap-date", "date", captionTimedLine(t, cfg.timeline, cfg.captionTiming, "date", lines.date)],
        ...Array.from(capEl.querySelectorAll(".cap-custom"), el => [`[data-custom="${el.dataset.custom}"]`, "title",
          el.dataset.independent === 'true' ? customTextAnimation(t, cfg.timeline, cfg.textLayers, el.dataset.custom) : lines.title]),
      ]) {
        const el = capEl.querySelector(sel);
        if (!el) continue;
        const isCustom = el.classList.contains('cap-custom');
        const isCaption = !isCustom && ['title', 'subtitle', 'date'].includes(name);
        if (isCaption) {
          const requested = cfg.captionTiming?.[`${name}RevealStyle`];
          el.dataset.revealStyle = ['fade-up', 'draw'].includes(requested) ? requested : 'fade';
        }
        const visual = isCustom || isCaption ? customTextVisual(baseLine, el.dataset.revealStyle) : null;
        const line = visual ? visual.line : baseLine;
        const accent = visual?.fade ? {rise:visual.rise, pen:0} : captionAccent(name, line, ph.name === "fade" || ph.name === "rest");
        if (visual) setStyleIfChanged(el, isCustom ? '--custom-reveal' : '--caption-reveal', visual.opacity.toFixed(4));
        setStyleIfChanged(el, "--p", line.outline.toFixed(4));
        if (line.fill !== undefined) setStyleIfChanged(el, "--f", line.fill.toFixed(4));
        const landing = isCaption && name === "title" && sequence
          ? introTitleLanding(ph, cfg.timeline, sequence.captionStart,
            directedMotion && el.dataset.revealStyle === "fade" && cfg.captionTiming?.titleTimingMode !== "custom") : 0;
        setStyleIfChanged(el, "--lift", `${((accent.rise * (name === "subtitle" ? 1 - (finale?.subtitleCenter ?? 0) : 1) + landing) * u).toFixed(3)}px`);
        setStyleIfChanged(el, "--pen", accent.pen.toFixed(4));
        if (line.fill !== undefined) {
          const glyphs = el.children;
          for (let i = 0; i < glyphs.length; i++) {
            const glyph = glyphReveal(line, i, glyphs.length);
            setStyleIfChanged(glyphs[i], "--o", glyph.outline.toFixed(4));
            setStyleIfChanged(glyphs[i], "--f", glyph.fill.toFixed(4));
            setStyleIfChanged(glyphs[i], "--gpen", (accent.pen * Math.sin(Math.PI * glyph.outline)).toFixed(4));
            if (isCaption && name === "title") {
              // Один световой жест связывает знак и штатный металлический титр.
              // Свой цвет и собственное время титра остаются без изменений.
              const shine = directedMotion && capEl.dataset.titleMetallic === "true" && cfg.captionTiming?.titleTimingMode !== "custom"
                ? titleGlintAtGlyph(cue.intensity * Math.min(1, Math.max(0, cfg.logo.glint)), cue.position, i, glyphs.length) : 0;
              const value = shine.toFixed(4);
              setStyleIfChanged(glyphs[i], "--title-shine", value);
              setStyleIfChanged(glyphs[i], "--title-metallic-gradient", metallicTitleCSS(Number(value)));
            }
          }
        }
      }
    }

    // Титр обновляется после всех CSS-переменных кадра: один путь для превью
    // и экспорта. В редакторе показываем DOM-слой, чтобы работали рамки.
    // Текст перерисовывается только когда он виден, но проход остаётся в цепочке
    // с нулевой непрозрачностью: кадр с титром и без него идёт по одному пути,
    // поэтому эталон compositeFrameAt(..., false) совпадает побитово.
    const caption = this._captionSource ? this._captionSource() : null;
    const captionShown = Boolean(caption) && this._captionVisible &&
      (this._captionOverride || !document.body.classList.contains("editor-on"));
    if (captionShown) this.captionLayer.update(caption.sceneId, caption.alpha ?? 1, true);
    this.captionPass.fullscreenMaterial.uniforms.uOpacity.value = captionShown ? (caption.alpha ?? 1) : 0;
    this.captionPass.enabled = Boolean(caption);

    // Камера интро плавно подъезжает к знаку; остальные ролики сохраняют общую композицию.
    const camK = finale?.active ? 0 : (1 - ph.reveal) * 0.6;
    // Долгий подъезд на удержании (настройка «Камера»). Считается по объёму
    // удержания, поэтому не зависит от частоты кадров и не ломает seek.
    const dolly = this._holdDolly(ph, cfg);
    this.camera.position.set(this.introStyle ? 0 : -0.6 * camK, this.introStyle ? 0 : 0.35 * camK,
      CAM_Z + 1.2 * opening.approach + dolly);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this._introCenter.copy(root.position).project(this.camera);
    this.background.uniforms.uIntroCenter.value.set(this._introCenter.x * this.camera.aspect, this._introCenter.y);

    // верхнее свечение: появляется вместе с логотипом
    updateTopIllumination(this.topLight, this.topGlow, cfg, ph.reveal, exposure);
    this.amberGlow.position.set(root.position.x, root.position.y + 0.15, root.position.z - 0.7);
    this.amberGlow.scale.setScalar(3.2 + 0.4 * scaleGrow);
    this.amberGlow.material.opacity = (cfg.logo.amber ?? 0) * 0.18 * ph.reveal * (cinematic ? 1 : 0.6);
    // Уменьшаем только видимую дымку, не мощность источника на металле.
    if (this.introStyle && cfg.logo.cinematic === true) {
      this.topGlow.material.opacity *= 0.48;
      this.topGlow.scale.multiplyScalar(0.78);
    }

    // искры при проявлении
    const pixel = (this.viewportH * this.pixelRatio) / (2 * Math.tan(this.fovRad / 2)) * 0.012;
    this.sparks.update(ph.emergeT, cfg, pixel, cfg.timeline.emergeDuration * 0.8);
    this.sparks.uniforms.uIntensity.value *= 1 + 0.8 * opening.strike;

    // Темнота полностью закрывает шов, в том числе непрерывный шум фона.
    this.seamCurtain.material.opacity = Math.max(seamCurtainOpacity(ph, cfg.timeline), finale?.blackout ?? 0);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;

    // постобработка
    this._applyPost(ph, cfg, t);
  }

  _applyPost(ph, cfg, t) {
    // Пресет качества (черновик/превью/мастер) накладывается поверх настроек
    // сцены, не переписывая их: сцена остаётся источником правды.
    const p = applyQualityPreset(cfg.post, this._quality);
    this.smaa.blendMode.opacity.value = p.smaa ? 1 : 0;
    this.dof.blendMode.opacity.value = p.dofEnabled ? 1 : 0;
    // размытие уходит в ноль, пока проявляется логотип (контур в начале остаётся чётким)
    this.dof.bokehScale = p.dofBokeh + p.dofStartBlur * 0.35 * (1 - ph.reveal);
    this.dof.circleOfConfusionMaterial.focusDistance = CAM_Z + p.dofFocusDistance;
    this.bloom.intensity = p.bloomIntensity;
    this.bloom.luminanceMaterial.threshold = p.bloomThreshold;
    this.bloom.radius = p.bloomRadius;
    this.chroma.offset.set(p.chromaticAberration, p.chromaticAberration);
    this.dither.strength = p.ditherEnabled === false ? 0 : (p.dither ?? 1);
  }

  render(dt) {
    this.composer.render(dt);
  }

  /** Текущий пресет качества кадра. */
  get quality() {
    return this._quality;
  }

  /**
   * Переключение пресета качества. Кадр меняется только по стоимости
   * сглаживания и блума, композиция и тайминги остаются прежними.
   * @param {string} id
   */
  setQuality(id) {
    const next = isQualityPreset(id) ? id : DEFAULT_QUALITY;
    if (next === this._quality) return false;
    this._quality = next;
    const sig = String(effectiveMsaa(this.cfg.post, next));
    if (sig !== this._msaaSig) {
      this._msaaSig = sig;
      this.composer.dispose();
      this._setupComposer();
      this.composer.setSize(this._w, this._h);
    }
    return true;
  }

  /**
   * Смещение камеры за время удержания: медленный подъезд на несколько
   * процентов, без ускорения на границах фазы.
   * @param {{name:string, local:number, beforeStart:boolean}} ph
   * @param {any} cfg
   * @returns {number}
   */
  _holdDolly(ph, cfg) {
    const amount = Number(cfg.camera?.holdDolly) || 0;
    if (amount <= 0 || ph.beforeStart) return 0;
    const tl = cfg.timeline;
    const holdStart = tl.drawDuration + tl.emergeDuration;
    const p = THREE.MathUtils.clamp((ph.local - holdStart) / Math.max(tl.holdDuration, 1e-4), 0, 1);
    // ease-out-quint: движение начинается сразу и мягко тормозит к уходу.
    const eased = 1 - Math.pow(1 - p, 5);
    return amount * eased;
  }

  /** Источник титра: возвращает {sceneId, alpha} или null, когда титра нет. */
  setCaptionSource(source) {
    this._captionSource = source;
  }

  /** Принудительно запечь титр в кадр — экспорт при открытом редакторе. */
  setCaptionOverride(on) {
    this._captionOverride = on === true;
  }

  /** Скрыть/показать титр без изменения настроек — для проверок кадра. */
  setCaptionVisible(visible) {
    this._captionVisible = visible !== false;
  }

  dispose() {
    this.captionLayer.dispose();
    this.contourWaves?.dispose();
    for (const cloud of Object.values(this.particleClouds)) cloud.dispose();
    this.logo.dispose();
    this.particles.dispose();
    this.plotter.dispose();
    this.solarBokeh.dispose();
    this.sparks.dispose();
    // При переключении роликов освобождаем также фон, кольца, световые
    // спрайты и окружение: иначе за время показа накапливаются GPU-ресурсы.
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => materials.add(item));
      else if (material) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.corners.glowTex.dispose();
    this.envTexture.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
