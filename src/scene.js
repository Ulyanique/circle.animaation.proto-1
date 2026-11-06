import * as THREE from "three";
import { OUTPUT } from "./scenes/catalog.js";
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
import { ContourWaves } from "./contour-waves.js";
import { Background, Corners, Particles } from "./fx.js";
import { Sparks, AnamorphicFlare } from "./sparks.js";
import { Plotter } from "./plotter.js";
import { SolarBokeh } from "./bokeh.js";
import { captionState, captionAccent, glyphReveal } from "./caption.js";
import { computePhase, compositionFocus, heroGlint, seamCurtainOpacity } from "./timeline.js";
import { introCues, introSequence } from "./scenes/cues.js";

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
  constructor(canvas, cfg, { intro = true } = {}) {
    this.cfg = cfg;
    this.isIntro = intro;
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
    this.scene.add(this.glintLight);

    this.fillLight = new THREE.DirectionalLight(0xffe2b0, 0.4);
    this.fillLight.position.set(4, 2, 6);
    this.scene.add(this.fillLight);

    // Логотип
    this.logo = new Logo();
    this.logo.root.position.set(0, 0, 0);
    this.scene.add(this.logo.root);
    // В интро чистый знак; расходящиеся копии контура — язык фоновых роликов.
    this.contourWaves = intro ? null : new ContourWaves(this.logo);
    if (this.contourWaves) this.scene.add(this.contourWaves.group);

    // Кольца и частицы: только левый верх и правый низ, как в исходной сцене.
    this.corners = new Corners();
    this.scene.add(this.corners.group);
    this.plotter = new Plotter(this.corners.glowTex, this.logo);
    this.scene.add(this.plotter.group);
    this.solarBokeh = new SolarBokeh();
    this.scene.add(this.solarBokeh.group);
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
    const RW = OUTPUT.width, RH = OUTPUT.height, ASPECT = RW / RH;
    const W = window.innerWidth, H = window.innerHeight;
    let cw = W, ch = W / ASPECT;
    if (ch > H) { ch = H; cw = H * ASPECT; }
    this.renderer.domElement.style.width = Math.round(cw) + "px";
    this.renderer.domElement.style.height = Math.round(ch) + "px";
    // подпись повторяет рамку канваса: --u = 1% ширины кадра
    const cap = document.getElementById("caption");
    if (cap) {
      cap.style.width = Math.round(cw) + "px";
      cap.style.height = Math.round(ch) + "px";
      cap.style.setProperty("--u", (cw / 100).toFixed(3) + "px");
    }
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
    const opening = this.isIntro ? introCues(ph, cfg.timeline) : { beams: 0, strike: 0, approach: 0 };
    const sequence = this.isIntro ? introSequence(ph, cfg.timeline, cfg.intro) : null;
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
    revealUniforms.uRevealGlow.value = cfg.logo.revealGlow * (ph.name === "emerge" || ph.name === "fade" ? 1.0 : 0.6) *
      (1 + opening.strike * 0.55);
    revealUniforms.uGlowColor.value.set(cfg.colors.glowColor);
    revealUniforms.uK.value = this.logo.parsed.K;

    // движение: пульсация + покачивание + плавное увеличение во время удержания
    const scaleGrow = THREE.MathUtils.lerp(cfg.logo.holdScaleFrom, cfg.logo.holdScaleTo, easeOutCubic(ph.grow));
    // частоты пульсации/покачивания кратны циклу → состояние логотипа периодично, шов бесшовный
    const quant = (f) => (f <= 0 ? 0 : Math.max(1, Math.round(f * ph.cycle)) / ph.cycle);
    const pulse = 1 + cfg.logo.pulseAmount * Math.sin(TAUt * quant(cfg.logo.pulseSpeed) * t);
    const z = -cfg.logo.shadowDepth * (1 - ph.reveal) * (1 - ph.reveal);
    const root = this.logo.root;
    const lift = sequence ? sequence.lift : 1;
    root.position.set(0, (Math.sin(TAUt * quant(cfg.logo.swaySpeed * 0.5) * t) * 0.02 + (cfg.logo.offsetY ?? 0)) * lift, z);
    root.scale.setScalar(cfg.logo.scale * scaleGrow * pulse * (0.55 + 0.45 * easeOutCubic(ph.reveal)));  // сначала контур в малом размере, затем логотип растёт
    // У интро знак входит с небольшого ракурса и разворачивается к зрителю.
    root.rotation.set(
      Math.cos(TAUt * quant(cfg.logo.swaySpeed * 0.7) * t + 1.0) * cfg.logo.swayAmount * 0.6 + 0.14 * opening.approach,
      Math.sin(TAUt * quant(cfg.logo.swaySpeed) * t) * cfg.logo.swayAmount - 0.50 * opening.approach,
      0
    );
    this.logo.updateOutline(ph.draw, ph.outline, cfg, ph.fill, ph.name === "fade");
    this.contourWaves?.update(t, ph, cfg);

    // кольца, свет из углов
    // В интро боковые круги появляются только после собранного знака.
    const env = sequence ? sequence.corners : ph.rings;
    const focus = compositionFocus(ph, cfg.timeline);
    const cornerEnv = env * (1 - 0.44 * focus);
    const cpos = this.corners.update(t, cfg, this.halfW, this.halfH, env, focus);
    if (this.isIntro) this.corners.centerRing.visible = false;
    this.solarBokeh.update(t, sequence ? { ...ph, rings: env } : ph, cfg, cpos);
    this.plotter.update(ph, cfg, sequence ? root.position.y : cfg.logo.offsetY);
    const tilt = THREE.MathUtils.degToRad(cfg.rings.tilt);
    this.particles.update(t, cfg, this.halfW, this.halfH, this.pixelRatio, this.viewportH, this.fovRad, cpos, cfg.rings.radius, tilt, cornerEnv);
    this.background.update(t, cfg);
    this.background.uniforms.uEnvL.value = cornerEnv;
    this.background.uniforms.uEnvR.value = cornerEnv;
    this.background.uniforms.uIntroLight.value = opening.beams;
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
    this.shadowPlane.material.opacity = cfg.lights.shadowOpacity;
    this.fillLight.intensity = cfg.lights.fillIntensity * exposure;
    // Один короткий тёплый проход по граням, пока собирается название.
    // На удержании ключевой акцент — текст, а не бегущий по нему блик.
    const cue = heroGlint(ph, cfg.timeline);
    revealUniforms.uSpecPass.value = cfg.logo.glint * cue.intensity;
    revealUniforms.uSpecX.value = cue.position * 1.7;
    const gx = cue.position * 1.25;
    this.glintLight.position.set(gx, 1.1, 2.2);
    this.glintLight.intensity = cfg.logo.glint * 7 * cue.intensity * exposure;
    const edgeFlare = 4 * ph.reveal * (1 - ph.reveal);
    this.flare.set(cue.intensity > 0 ? gx : 0, cfg.post.anamorphic * cfg.logo.glint * 0.16 * cue.intensity +
      cfg.post.anamorphic * (0.055 * edgeFlare + 0.30 * opening.strike), cfg.colors.goldHighlight, 1.1,
      1.2 + 2.0 * opening.strike);

    // Один и тот же t всегда даёт один и тот же кадр подписи, даже после seek.
    const capEl = document.getElementById("caption");
    if (capEl) {
      const { progress, lines } = captionState(t, cfg.timeline, sequence?.captionStart);
      const k = THREE.MathUtils.smoothstep(progress, 0.0, 0.8);
      capEl.style.opacity = "1";
      capEl.style.setProperty("--drift", `${((1 - k) * window.innerHeight * 0.008).toFixed(3)}px`);
      capEl.style.transform = "translate(-50%, calc(-50% + var(--drift)))";
      const u = parseFloat(capEl.style.getPropertyValue("--u")) || 19.2;
      for (const [sel, name, line] of [
        [".cap-title", "title", lines.title], [".r1", "rule1", lines.rule1],
        [".cap-sub", "subtitle", lines.subtitle], [".r2", "rule2", lines.rule2],
        [".cap-date", "date", lines.date],
      ]) {
        const el = capEl.querySelector(sel);
        if (!el) continue;
        const accent = captionAccent(name, line, ph.name === "fade" || ph.name === "rest");
        setStyleIfChanged(el, "--p", line.outline.toFixed(4));
        if (line.fill !== undefined) setStyleIfChanged(el, "--f", line.fill.toFixed(4));
        setStyleIfChanged(el, "--lift", `${(accent.rise * u).toFixed(3)}px`);
        setStyleIfChanged(el, "--pen", accent.pen.toFixed(4));
        if (line.fill !== undefined) {
          const glyphs = el.children;
          for (let i = 0; i < glyphs.length; i++) {
            const glyph = glyphReveal(line, i, glyphs.length);
            setStyleIfChanged(glyphs[i], "--o", glyph.outline.toFixed(4));
            setStyleIfChanged(glyphs[i], "--f", glyph.fill.toFixed(4));
            setStyleIfChanged(glyphs[i], "--gpen", (accent.pen * Math.sin(Math.PI * glyph.outline)).toFixed(4));
          }
        }
      }
    }

    // Камера интро плавно подъезжает к знаку; остальные ролики сохраняют общую композицию.
    const camK = (1 - ph.reveal) * 0.6;
    this.camera.position.set(-0.6 * camK, 0.35 * camK, CAM_Z + 1.2 * opening.approach);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this._introCenter.copy(root.position).project(this.camera);
    this.background.uniforms.uIntroCenter.value.set(this._introCenter.x * OUTPUT.width / OUTPUT.height, this._introCenter.y);

    // верхнее свечение: появляется вместе с логотипом
    this.topLight.intensity = cfg.lights.topGlow * ph.reveal * exposure;
    this.topGlow.material.opacity = Math.min(1, 0.6 * ph.reveal * cfg.lights.topGlow / 40);

    // искры при проявлении
    const pixel = (this.viewportH * this.pixelRatio) / (2 * Math.tan(this.fovRad / 2)) * 0.012;
    this.sparks.update(ph.emergeT, cfg, pixel, cfg.timeline.emergeDuration * 0.8);
    this.sparks.uniforms.uIntensity.value *= 1 + 0.8 * opening.strike;

    // Темнота полностью закрывает шов, в том числе непрерывный шум фона.
    this.seamCurtain.material.opacity = seamCurtainOpacity(ph, cfg.timeline);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;

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
    this.contourWaves?.dispose();
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
