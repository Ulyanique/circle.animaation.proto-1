import * as THREE from "three";

// Только для первого ролика: циркуль становится источником расходящегося
// золотого светового фронта в момент превращения чертежа в металл.
// Плоскость за знаком: не заслоняет гравировку и никогда не белит титры.
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTravel;
  uniform float uEnergy;
  uniform vec3 uGold;
  void main() {
    vec2 p = (vUv - 0.5) * vec2(7.4, 5.0);
    float r = length(p);
    float a = atan(p.y, p.x);
    float front = 0.14 + uTravel * 2.35;
    float edge = exp(-pow((r - front) * 11.0, 2.0));
    float atmosphere = exp(-pow((r - front) * 3.2, 2.0));
    // 12 мягких лучей идут за волной, как разметка циркулем, а не вспышка
    // поверх всего кадра. Их движение привязано только к абсолютному времени.
    float rays = pow(0.5 + 0.5 * cos(a * 12.0 - uTravel * 5.0), 8.0);
    float light = edge * (0.55 + 0.45 * rays) + atmosphere * 0.13;
    gl_FragColor = vec4(uGold * (0.7 + 0.3 * rays), light * uEnergy);
  }
`;

export class OpeningPulse {
  constructor() {
    this.uniforms = {
      uTravel: { value: 0 },
      uEnergy: { value: 0 },
      uGold: { value: new THREE.Color(0xf8bc67) },
    };
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.4, 5.0),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      })
    );
    this.mesh.position.set(0, 1.1, -1);
    this.mesh.renderOrder = -2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(cue, y) {
    this.mesh.visible = cue.energy > 0.001;
    this.mesh.position.y = y;
    this.uniforms.uTravel.value = cue.travel;
    this.uniforms.uEnergy.value = cue.energy;
  }
}
