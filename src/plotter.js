import * as THREE from "three";
import { OUTPUT } from "./scenes/catalog.js";
import { plotSequence } from "./timeline.js";

const START_ANGLE = Math.PI * 0.75; // верхняя левая точка — связь с первым кольцом
const TAU = Math.PI * 2;
const SAMPLES = 256;
const VERT = /* glsl */ `
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aProgress;
  attribute float aSide;
  uniform vec2 uRes;
  uniform float uSweep;
  uniform float uTransfer;
  uniform float uDirected;
  varying float vProgress;
  varying float vSide;
  varying float vTail;
  void main() {
    vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(aPrev, 1.0);
    vec4 n = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
    vec2 tangentPx = (n.xy / n.w - p.xy / p.w) * uRes;
    tangentPx = length(tangentPx) > 0.0001 ? normalize(tangentPx) : vec2(1.0, 0.0);
    vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
    float behind = max(0.0, uSweep - aProgress);
    // Короткое, привязанное к времени пламя у наконечника вместо следа предыдущих кадров.
    float tail = exp(-behind * behind * mix(180.0, 105.0, uDirected)) * (1.0 - uTransfer);
    float halfWidthPx = 0.62 + mix(1.0, 1.25, uDirected) * tail;
    c.xy += normalPx * aSide * halfWidthPx * 2.0 / uRes * c.w;
    gl_Position = c;
    vProgress = aProgress;
    vSide = aSide;
    vTail = tail;
  }
`;
const FRAG = /* glsl */ `
  uniform float uSweep;
  uniform float uOpacity;
  uniform vec3 uGold;
  varying float vProgress;
  varying float vSide;
  varying float vTail;
  void main() {
    if (vProgress > uSweep) discard;
    float edge = 1.0 - smoothstep(0.34, 1.0, abs(vSide));
    float power = (0.40 + 0.60 * vTail) * edge;
    gl_FragColor = vec4(uGold * (0.62 + 0.58 * vTail), uOpacity * power);
  }
`;

// Как у экранной MeshLine: две вершины с противоположным смещением на каждую
// точку пути. Но геометрия статична; только uniform от абсолютного времени
// определяет рисунок, так что PNG после seek совпадает с прямым воспроизведением.
function makeOrbitRibbon(startAngle = START_ANGLE, sweepAngle = TAU) {
  const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
  const prev = new Float32Array(positions.length);
  const next = new Float32Array(positions.length);
  const steps = new Float32Array((SAMPLES + 1) * 2);
  const sides = new Float32Array(steps.length);
  const indices = new Uint16Array(SAMPLES * 6);
  const pointAt = (i) => {
    const a = startAngle - i / SAMPLES * sweepAngle;
    return [Math.cos(a), Math.sin(a), 0];
  };
  for (let i = 0; i <= SAMPLES; i++) {
    const point = pointAt(i), before = pointAt(i - 1), after = pointAt(i + 1);
    for (let side = 0; side < 2; side++) {
      const v = i * 2 + side;
      positions.set(point, v * 3);
      prev.set(before, v * 3);
      next.set(after, v * 3);
      steps[v] = i / SAMPLES;
      sides[v] = side ? 1 : -1;
    }
    if (i < SAMPLES) {
      const v = i * 2;
      indices.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  geometry.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  geometry.setAttribute("aProgress", new THREE.BufferAttribute(steps, 1));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/** Построительные точки рисуют орбиту и передают свет логотипу. */
export class Plotter {
  constructor(glowTexture, logo, { twoHeads = false, finale = false } = {}) {
    this.twoHeads = twoHeads;
    this.finale = finale;
    this.logo = logo;
    this._target = new THREE.Vector3();
    this.group = new THREE.Group();
    this.uniforms = {
      uSweep: { value: 0 },
      uOpacity: { value: 0 },
      uTransfer: { value: 0 },
      uDirected: { value: 0 },
      uRes: { value: new THREE.Vector2(OUTPUT.width, OUTPUT.height) },
      uGold: { value: new THREE.Color(0xe0b25a) },
    };
    this.line = new THREE.Mesh(makeOrbitRibbon(START_ANGLE, twoHeads ? Math.PI : TAU), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.line.renderOrder = 3;
    this.group.add(this.line);
    if (twoHeads) {
      this.line2 = new THREE.Mesh(makeOrbitRibbon(START_ANGLE + Math.PI, Math.PI), this.line.material);
      this.line2.renderOrder = 3;
      this.group.add(this.line2);
    }

    this.head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffda82, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.head.scale.setScalar(0.17);
    this.head.position.z = 0.025;
    this.head.renderOrder = 4;
    this.group.add(this.head);
    if (twoHeads) {
      this.head2 = new THREE.Sprite(this.head.material.clone());
      this.head2.scale.copy(this.head.scale);
      this.head2.renderOrder = 4;
      this.group.add(this.head2);
    }
  }

  /** Ширина ленты задаётся в пикселях кадра — при смене мастера её надо обновить. */
  setResolution(w, h) {
    this.uniforms.uRes.value.set(w, h);
  }

  update(phase, cfg, centerY = cfg.logo.offsetY, centerX = cfg.logo.offsetX ?? 0) {
    const directed = this.twoHeads && !this.finale && cfg.logo.directedMotion === true;
    const { sweep, transfer, opacity, head, trace, reverse } = plotSequence(phase, cfg.timeline, { intro: this.twoHeads, finale: this.finale, directed });
    this.group.visible = cfg.rings.enabled && (opacity > 0.001 || head > 0.001);
    if (!this.group.visible) return;
    this.group.position.set(centerX, centerY, -0.08);
    this.group.scale.setScalar(cfg.rings.radius * 0.8);
    this.uniforms.uSweep.value = sweep;
    this.uniforms.uTransfer.value = transfer;
    this.uniforms.uDirected.value = directed ? 1 : 0;
    this.uniforms.uOpacity.value = opacity * 0.7;
    this.uniforms.uGold.value.set(cfg.colors.ringColor);
    const a = START_ANGLE - sweep * (this.twoHeads ? Math.PI : TAU);
    this.head.position.set(Math.cos(a), Math.sin(a), 0.025);
    // Лёгкое усиление во время движения; при передаче и в покое исходный размер.
    const headSize = 0.17 * (1 + (directed ? 0.22 * Math.sin(Math.PI * sweep) * (1 - transfer) : 0));
    this.head.scale.setScalar(headSize);
    if (this.head2) this.head2.scale.setScalar(headSize);
    if (this.head2) {
      this.head2.position.set(-Math.cos(a), -Math.sin(a), 0.025);
      this.head2.material.color.set(cfg.colors.goldHighlight);
      // Вторая точка растворяется на окружности, пока первая переходит к контуру.
      this.head2.material.opacity = head * 0.48 * (1 - transfer);
    }
    if (transfer > 0 && head > 0 && this.logo.outlineAnchors?.length >= 2) {
      // В начале точка идёт к первой точке SVG. При обратном уходе она
      // следует за кончиком последней дуги и затем возвращается на орбиту.
      if (reverse) {
        const point = this.logo.parsed.subPaths[0].getPointAt(trace);
        this._target.set(point.x - this.logo.parsed.cx, point.y - this.logo.parsed.cy, 0);
      } else {
        this._target.set(this.logo.outlineAnchors[0], this.logo.outlineAnchors[1], 0);
      }
      this.logo.root.updateWorldMatrix(true, true);
      this.logo.outline.localToWorld(this._target);
      this.group.worldToLocal(this._target);
      this.head.position.lerp(this._target, transfer);
    }
    this.head.material.color.set(cfg.colors.goldHighlight);
    this.head.material.opacity = head * 0.48;
  }

  dispose() {
    this.line.geometry.dispose();
    this.line2?.geometry.dispose();
    this.line.material.dispose();
    this.head.material.dispose(); // текстура общая с кольцами
    this.head2?.material.dispose();
  }
}
