import * as THREE from "three";

// Только для первого ролика. Один полноэкранный аддитивный слой ведёт три
// связанных такта: игла света находит точку чертежа, превращение в золото
// отпускает световую волну, последняя буква запирает композицию штрихом.
// Плоскость за знаком: не заслоняет гравировку и никогда не белит титры.
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTravel;
  uniform float uEnergy;
  uniform float uTrace;
  uniform float uTraceTravel;
  uniform float uSeal;
  uniform float uSealTravel;
  uniform vec2 uWaveCenter;
  uniform vec2 uTraceTarget;
  uniform vec3 uGold;

  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    return length(p - a - ab * h);
  }

  void main() {
    float cueStrength = uEnergy + uTrace + uSeal;
    if (cueStrength < 0.0001) discard;

    // Мировые координаты относительно центра кадра; плоскость неподвижна,
    // поэтому подпись и холодный старт не дрейфуют вместе с логотипом.
    vec2 p = (vUv - 0.5) * vec2(9.6, 5.4);
    vec2 q = p - uWaveCenter;
    float r = length(q);
    float a = atan(q.y, q.x);

    // 1. Игла света приходит из верхнего левого источника точно в первую
    // точку построительной окружности. Свет живёт на конце иглы, не в кадре.
    vec2 source = vec2(-4.35, 2.35);
    vec2 target = uTraceTarget;
    vec2 tip = mix(source, target, max(uTraceTravel, 0.001));
    vec2 shaft = tip - source;
    float along = clamp(dot(p - source, shaft) / max(dot(shaft, shaft), 1e-6), 0.0, 1.0);
    float needle = 1.0 - smoothstep(0.004, 0.013, segmentDistance(p, source, tip));
    float tipHalo = exp(-pow(length(p - tip) / 0.13, 2.0));
    float tipCore = exp(-pow(length(p - tip) / 0.028, 2.0));
    float puncture = exp(-pow((length(p - target) - 0.09) * 52.0, 2.0)) *
      smoothstep(0.76, 1.0, uTraceTravel);
    float traceLight = (needle * 0.19 * (0.3 + 0.7 * along) +
      tipHalo * 0.30 + tipCore * 0.52 + puncture * 0.16) * uTrace;

    // 2. Волна раскрытия: не сплошной ореол, а фронт из двенадцати лучей и две
    // тонкие направляющие, повторяющие разведённые ножки циркуля.
    float front = 0.14 + uTravel * 2.35;
    float edge = exp(-pow((r - front) * 11.0, 2.0));
    float atmosphere = exp(-pow((r - front) * 3.2, 2.0));
    float rays = pow(0.5 + 0.5 * cos(a * 12.0 - uTravel * 5.0), 8.0);
    float ring = edge * (0.18 + 0.82 * rays) + atmosphere * 0.10;
    float reach = max(uTravel, 0.001);
    float leftLeg = 1.0 - smoothstep(0.004, 0.018,
      segmentDistance(q, vec2(0.0), vec2(-0.72, -1.05) * reach));
    float rightLeg = 1.0 - smoothstep(0.004, 0.018,
      segmentDistance(q, vec2(0.0), vec2(0.72, -1.05) * reach));
    float legs = (leftLeg + rightLeg) * exp(-r * 0.62) * 0.30;
    float heart = exp(-r * r * 75.0) * 0.20;
    float waveLight = (ring + legs + heart) * uEnergy;

    // 3. Подпись: из центра разводится тонкая линия и мягкое перо проходит
    // по строке. Слой позади букв, поэтому текст остаётся контрастным.
    float titleY = p.y + 0.27;
    float halfSpan = mix(0.12, 3.05, uSealTravel);
    float spanMask = 1.0 - smoothstep(halfSpan, halfSpan + 0.08, abs(p.x));
    float hairline = exp(-pow(titleY * 155.0, 2.0)) * spanMask * 0.30;
    float ends = exp(-pow((abs(p.x) - halfSpan) * 30.0, 2.0)) *
      exp(-pow(titleY * 32.0, 2.0)) * 0.44;
    float penX = mix(-2.85, 2.85, uSealTravel);
    float pen = exp(-pow((p.x - penX) * 8.0, 2.0)) *
      exp(-pow(titleY * 17.0, 2.0)) * 0.17;
    float sealLight = (hairline + ends + pen) * uSeal;

    float alpha = clamp(traceLight + waveLight + sealLight, 0.0, 1.0);
    vec3 color = uGold * (0.72 + 0.28 * rays);
    color = mix(color, vec3(1.0, 0.87, 0.63),
      clamp(tipCore * 0.34 + (ends + pen) * 0.12, 0.0, 0.5));
    gl_FragColor = vec4(color, alpha);
  }
`;

/** @param {string} [color] — цвет из палитры активной сцены. */
export class OpeningPulse {
  constructor(color = "#e0b25a") {
    this.uniforms = {
      uTravel: { value: 0 },
      uEnergy: { value: 0 },
      uTrace: { value: 0 },
      uTraceTravel: { value: 0 },
      uSeal: { value: 0 },
      uSealTravel: { value: 0 },
      uWaveCenter: { value: new THREE.Vector2(0, 1.1) },
      uTraceTarget: { value: new THREE.Vector2(-0.76, 1.86) },
      uGold: { value: new THREE.Color(color) },
    };
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 5.4),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    this.mesh.position.set(0, 0, -1);
    this.mesh.renderOrder = -2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(cue, waveCenter, traceTarget) {
    this.mesh.visible = Math.max(cue.energy, cue.trace, cue.seal) > 0.001;
    this.uniforms.uTravel.value = cue.travel;
    this.uniforms.uEnergy.value = cue.energy;
    this.uniforms.uTrace.value = cue.trace;
    this.uniforms.uTraceTravel.value = cue.traceTravel;
    this.uniforms.uSeal.value = cue.seal;
    this.uniforms.uSealTravel.value = cue.sealTravel;
    this.uniforms.uWaveCenter.value.set(waveCenter.x, waveCenter.y);
    this.uniforms.uTraceTarget.value.set(traceTarget.x, traceTarget.y);
  }
}
