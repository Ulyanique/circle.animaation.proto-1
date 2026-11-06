import * as THREE from "three";
import { BrandScene } from "./brand-scene.js";
import { finaleCues } from "./scenes/cues.js";
import { finaleSequence } from "./finale-sequence.js";
import { revealUniforms } from "./logo.js";

/** №9: та же прорисовка циркуля и живое золотое поле, но новая концовка —
 * стирание строк → перевод лого в центр → удаление по z → обратный контур →
 * центральная построительная окружность из начала №1. Все огибающие чистые
 * функции абсолютного времени; затем темнота закрывает шов цикла. */
export class FinaleScene extends BrandScene {
  /** @param {HTMLCanvasElement} canvas @param {any} config */
  constructor(canvas, config) {
    super(canvas, config);
    this.finalCircle = new THREE.Mesh(
      new THREE.RingGeometry(0.994, 1.006, 256),
      new THREE.MeshBasicMaterial({
        color: 0xe0b25a, transparent: true, opacity: 0,
        depthTest: false, depthWrite: false, toneMapped: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
    );
    this.finalCircle.position.set(0, 0, -0.08);
    this.finalCircle.renderOrder = 6;
    this.scene.add(this.finalCircle);
  }

  update(t, dt) {
    super.update(t, dt);
    const cue = finaleCues(t, this.brandConfig.timeline.holdDuration);
    // Внутренний this.cfg.timeline хранит укороченное «удержание» полевой сцены;
    // чистые фазы читают полный 18-секундный цикл из проектного конфига.
    const seq = finaleSequence(t, this.brandConfig);
    const L = this.cfg.layout;
    const root = this.logo.root;
    root.position.x = L.logoX;
    root.position.y = L.logoY * (1 - seq.logoCenter);
    root.position.z -= seq.depth * seq.depthTravel;
    root.scale.multiplyScalar(cue.symbol * (1 - 0.75 * seq.depth));
    // Золото уходит вместе с удалением знака; контур отматывается последним.
    revealUniforms.uReveal.value *= 1 - seq.depth;
    if (seq.contour > 0.001) {
      this.logo.updateOutline(1 - seq.contour, Math.max(cue.symbol, 1 - seq.contour), this.cfg, 0, true);
    }
    // Множители фона, верхнего свечения и волн уже пришли из layout в BrandScene;
    // здесь поверх них работает только общая огибающая финального ухода.
    const dim = 1 - 0.45 * seq.depth;
    this.background.uniforms.uEnvL.value *= cue.light * dim;
    this.background.uniforms.uEnvR.value *= cue.light * dim;
    this.topGlow.material.opacity *= cue.light * dim;
    this.waves.pulses.forEach(({ material }) => { material.opacity *= cue.light * dim; });
    // Пока виден финальный круг, прежняя «темнота по уходу символа» не должна
    // перекрывать его; к шву круга уже нет и заслонка снова закрывает кадр.
    const circleLight = Math.min(1, seq.finalCircle * 2.5);
    const curtain = Math.max(0, 1 - cue.symbol) * (1 - circleLight);
    this.seamCurtain.material.opacity = Math.max(this.seamCurtain.material.opacity, curtain);
    this.seamCurtain.visible = this.seamCurtain.material.opacity > 0.001;
    this.finalCircle.visible = seq.finalCirclePreset === "center-construction" && seq.finalCircle > 0.001;
    this.finalCircle.scale.setScalar(Math.max(0.1, this.cfg.rings.radius * seq.circleRadius));
    this.finalCircle.material.opacity = seq.finalCircle * seq.circleOpacity;
    this.finalCircle.material.color.set(this.cfg.colors.ringColor);
    this._letterLine(".cap-title", cue.titleOutline, cue.titleFill, 0.72, seq.captionErase);
    this._letterLine(".cap-sub", cue.phraseOutline, cue.phraseFill, 0.48, seq.captionErase);
    this.applyEditorElements(t);
  }
}
