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
import { Background, Corners, Particles } from "./fx.js";
import { Sparks, AnamorphicFlare } from "./sparks.js";
import { Plotter } from "./plotter.js";
import { SolarBokeh } from "./bokeh.js";
import { captionState, captionAccent, glyphReveal } from "./caption.js";
import { computePhase, compositionFocus, heroGlint, seamCurtainOpacity } from "./timeline.js";

const FOV = 30;
const CAM_Z = 9;
const REVEAL_MAX = 2.9; // радиус проявления, покрывающий весь логотип
const TAU = Math.PI * 2;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

export { computePhase } from "./timeline.js";

export class LogoScene {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    // Кэш DOM-титра пересоздаётся вместе со сценой и при resize. Он убирает
    // десятки одинаковых style.setProperty на каждом неподвижном кадре.
    this._captionRefs = null;
    this._captionU = 19.2;
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

    // Кольца и частицы
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

    // Сохраняем проход DOF: при нулевой прозрачности его можно полностью
    // пропустить, не перестраивая цепочку renderToScreen (он не последний).
    this.dofPass = new EffectPass(this.camera, this.dof);
    this.composer.addPass(this.dofPass);
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
      this._captionU = cw / 100;
    } else {
      this._captionU = 19.2;
    }
    // После смены масштаба все производные от --u значения должны записаться заново.
    this._captionRefs = null;
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

  /** Один раз запоминаем узлы титра и последнее записанное значение CSS. */
  _captionNodes() {
    if (this._captionRefs) return this._captionRefs;
    const cap = document.getElementById("caption");
    if (!cap) return null;
    const rows = [];
    for (const [sel, name] of [
      [".cap-title", "title"], [".r1", "rule1"], [".cap-sub", "subtitle"],
      [".r2", "rule2"], [".cap-date", "date"],
    ]) {
      const el = cap.querySelector(sel);
      if (!el) continue;
      const glyphs = Array.from(el.children);
      rows.push({
        el, name, glyphs,
        style: new Map(),
        glyphStyles: glyphs.map(() => new Map()),
      });
    }
    this._captionRefs = { cap, style: new Map(), rows };
    return this._captionRefs;
  }

  /** Пропускаем запись в DOM, если абсолютное время даёт то же значение. */
  _setCaptionStyle(cache, el, name, value) {
    if (cache.get(name) === value) return;
    cache.set(name, value);
    el.style.setProperty(name, value);
  }

  /** Вызывается после смены текста/шрифта: узлы глифов пересоздаются в main.js. */
  invalidateCaptionCache() {
    this._captionRefs = null;
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
    root.position.set(0, Math.sin(TAUt * quant(cfg.logo.swaySpeed * 0.5) * t) * 0.02 + (cfg.logo.offsetY ?? 0), z);
    root.scale.setScalar(cfg.logo.scale * scaleGrow * pulse * (0.55 + 0.45 * easeOutCubic(ph.reveal)));  // сначала контур в малом размере, затем логотип растёт
    root.rotation.set(
      Math.cos(TAUt * quant(cfg.logo.swaySpeed * 0.7) * t + 1.0) * cfg.logo.swayAmount * 0.6,
      Math.sin(TAUt * quant(cfg.logo.swaySpeed) * t) * cfg.logo.swayAmount,
      0
    );
    this.logo.updateOutline(ph.draw, ph.outline, cfg, ph.fill, ph.name === "fade");

    // кольца, свет из углов
    const env = ph.rings;
    const focus = compositionFocus(ph, cfg.timeline);
    const cornerEnv = env * (1 - 0.44 * focus);
    const cpos = this.corners.update(t, cfg, this.halfW, this.halfH, env, focus);
    this.solarBokeh.update(t, ph, cfg, cpos);
    this.plotter.update(ph, cfg);
    const tilt = THREE.MathUtils.degToRad(cfg.rings.tilt);
    this.particles.update(t, cfg, this.halfW, this.halfH, this.pixelRatio, this.viewportH, this.fovRad, cpos, cfg.rings.radius, tilt, cornerEnv);
    this.background.update(t, cfg);
    this.background.uniforms.uEnvL.value = cornerEnv;
    this.background.uniforms.uEnvR.value = cornerEnv;
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
      cfg.post.anamorphic * 0.055 * edgeFlare, cfg.colors.goldHighlight, 1.1, 1.2);

    // Один и тот же t всегда даёт один и тот же кадр подписи, даже после seek.
    // Кэш узлов и значений удаляет повторные записи в DOM на неподвижных кадрах.
    const caption = this._captionNodes();
    if (caption) {
      const { progress, lines } = captionState(t, cfg.timeline);
      const k = THREE.MathUtils.smoothstep(progress, 0.0, 0.8);
      this._setCaptionStyle(caption.style, caption.cap, "opacity", "1");
      this._setCaptionStyle(caption.style, caption.cap, "--drift",
        `${((1 - k) * window.innerHeight * 0.008).toFixed(3)}px`);
      this._setCaptionStyle(caption.style, caption.cap, "transform",
        "translate(-50%, calc(-50% + var(--drift)))");
      const u = this._captionU;
      const exiting = ph.name === "fade" || ph.name === "rest";
      for (const row of caption.rows) {
        const line = lines[row.name];
        if (!line) continue;
        const accent = captionAccent(row.name, line, exiting);
        this._setCaptionStyle(row.style, row.el, "--p", line.outline.toFixed(4));
        if (line.fill !== undefined) {
          this._setCaptionStyle(row.style, row.el, "--f", line.fill.toFixed(4));
        }
        this._setCaptionStyle(row.style, row.el, "--lift", `${(accent.rise * u).toFixed(3)}px`);
        this._setCaptionStyle(row.style, row.el, "--pen", accent.pen.toFixed(4));
        if (line.fill !== undefined) {
          for (let i = 0; i < row.glyphs.length; i++) {
            const glyph = glyphReveal(line, i, row.glyphs.length);
            const cache = row.glyphStyles[i];
            this._setCaptionStyle(cache, row.glyphs[i], "--o", glyph.outline.toFixed(4));
            this._setCaptionStyle(cache, row.glyphs[i], "--f", glyph.fill.toFixed(4));
            this._setCaptionStyle(cache, row.glyphs[i], "--gpen",
              (accent.pen * Math.sin(Math.PI * glyph.outline)).toFixed(4));
          }
        }
      }
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

    // Темнота полностью закрывает шов, в том числе непрерывный шум фона.
    this.seamCurtain.material.opacity = seamCurtainOpacity(ph, cfg.timeline);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;

    // постобработка
    this._applyPost(ph, cfg, t);
  }

  _applyPost(ph, cfg, t) {
    const p = cfg.post;
    this.smaa.blendMode.opacity.value = p.smaa ? 1 : 0;
    const dofOpacity = p.dofEnabled ? 1 : 0;
    this.dof.blendMode.opacity.value = dofOpacity;
    // Полноэкранный DOF с нулевой прозрачностью всё равно стоил отдельного
    // дорогого прохода. Пропускаем его, сохраняя остальные эффекты и порядок
    // вывода на экран; при включении настройки проход возвращается сразу.
    const dofActive = dofOpacity > 0;
    if (this.dofPass.enabled !== dofActive) this.dofPass.enabled = dofActive;
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
