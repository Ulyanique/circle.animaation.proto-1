import { Effect } from "postprocessing";
import { Uniform } from "three";

/**
 * Финальный дизеринг перед 8-битным выводом.
 *
 * Тёмные градиенты этого проекта (верхнее свечение, угловые засветки, дымка)
 * при квантовании в 8 бит дают видимые полосы, особенно после H.264. Шум
 * амплитудой ±0.5 LSB разбивает ступени, не добавляя заметного зерна.
 *
 * Дизеринг считается в пространстве отображения (sRGB), поэтому амплитуда
 * одинаково ощутима и в тенях, и в светах. Узор статичен по пикселям: он не
 * мерцает во времени и не конфликтует с покадровым экспортом.
 */
const fragmentShader = /* glsl */ `
  uniform float strength;

  // Межпиксельный градиентный шум (Jimenez): без регулярной сетки и полос.
  float ditherNoise(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }

  vec3 linearToSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }

  vec3 sRGBToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 display = linearToSRGB(clamp(inputColor.rgb, 0.0, 1.0));
    float offset = (ditherNoise(gl_FragCoord.xy) - 0.5) * (strength / 255.0);
    outputColor = vec4(sRGBToLinear(clamp(display + offset, 0.0, 1.0)), inputColor.a);
  }
`;

export class DitherEffect extends Effect {
  /** @param {{strength?: number}} [options] */
  constructor({ strength = 1 } = {}) {
    super("DitherEffect", fragmentShader, {
      uniforms: new Map([["strength", new Uniform(strength)]]),
    });
  }

  get strength() {
    return this.uniforms.get("strength").value;
  }

  set strength(value) {
    this.uniforms.get("strength").value = Math.max(0, Math.min(4, Number(value) || 0));
  }
}
