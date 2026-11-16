import * as THREE from "three";
import { drawCaption } from "./caption-compositor.js";

/**
 * Титр как часть кадра, а не слой поверх него.
 *
 * Текст рисуется в canvas в разрешении мастера и попадает в композитор
 * отдельным проходом между цветокоррекцией и тонмаппингом: буквы получают
 * общий тон, сглаживание SMAA и финальный дизеринг, но не размываются
 * глубиной резкости, блумом и хроматической аберрацией — иначе на большом
 * экране текст «плывёт» и выглядит дешёвой печатью с несовмещением.
 *
 * DOM-титр остаётся только для редактора: там нужны измеримые буквы и рамки.
 */
export const CAPTION_SHADER = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D inputBuffer;
    uniform sampler2D uCaption;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(inputBuffer, vUv);
      vec4 cap = texture2D(uCaption, vUv);
      float a = cap.a * uOpacity;
      vec3 color = mix(base.rgb, cap.rgb, a);
      gl_FragColor = vec4(color, max(base.a, a));
    }`,
};

export class CaptionLayer {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 16;
    this.canvas.height = 9;
    // Программный растр: пиксели титра не должны зависеть от пути кадров.
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.visible = false;
    this._width = 0;
    this._height = 0;
  }

  /** Разрешение текстуры совпадает с мастер-кадром: пиксель в пиксель. */
  setSize(width, height) {
    if (this._width === width && this._height === height) return;
    this._width = width;
    this._height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    // Программный растр: пиксели титра не должны зависеть от пути кадров.
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.texture.needsUpdate = true;
  }

  /**
   * @param {string} sceneId
   * @param {number} alpha
   * @param {boolean} visible
   * @returns {boolean} нужно ли рисовать проход в этом кадре
   */
  update(sceneId, alpha, visible) {
    this.visible = Boolean(visible);
    if (!this.visible) return false;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this._width, this._height);
    drawCaption(this.ctx, alpha, sceneId);
    this.texture.needsUpdate = true;
    return true;
  }

  dispose() {
    this.texture.dispose();
  }
}
