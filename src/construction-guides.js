import * as THREE from 'three';
import { effectVisibility } from './effect-timing.js';
import { customTextAnimation } from './custom-text.js';
import { constructionSegments, introCrossSegments, introGuidesVisibility, introGuidesProgress } from './scenes/construction-layout.js';
import { ringSideVisible } from './scenes/ring-sides.js';

/** Незаметные линии-разметка знака и перекрестия только двух боковых кругов. */
export class ConstructionGuides {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'construction-guides';
    this.material = new THREE.LineBasicMaterial({color: '#d9b268', transparent: true, opacity: 0, depthWrite: false, depthTest: false});
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade; varying float vGuideFade;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGuideFade = aFade;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGuideFade;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vGuideFade;');
    };
    const segments = points => {
      const geometry = new THREE.BufferGeometry();
      const vertices = [], fades = [];
      for (let i = 0; i < points.length; i += 2) {
        const [x1, y1] = points[i], [x2, y2] = points[i + 1];
        for (let step = 0; step < 32; step++) for (const t of [step / 32, (step + 1) / 32]) {
          vertices.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0);
          fades.push(Math.sin(Math.PI * t) ** .7);
        }
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(fades, 1));
      return new THREE.LineSegments(geometry, this.material);
    };
    // Парные направляющие продолжают ножки за пределы знака.
    this.center = segments(constructionSegments());
    this.introCenter = segments(introCrossSegments());
    this.introCenter.visible = false;
    this.crosses = Object.fromEntries(['left', 'right'].map(side => [side, segments([[-1.1,0],[1.1,0],[0,-.75],[0,.75]])]));
    this.group.add(this.center, this.introCenter, this.crosses.left, this.crosses.right);
  }
  update(time, phase, config, root, corners, intro = false) {
    const g = config.constructionGuides;
    const visibility = intro && g?.timingMode !== 'custom' ? introGuidesVisibility(phase, config.timeline) : effectVisibility(time, phase, config.timeline, g);
    this.group.visible = !!g && g.enabled !== false && visibility > .001;
    if (!this.group.visible) return;
    const scale = Math.max(.2, Math.min(3, g.scale));
    const x = root.position.x + g.offsetX, y = root.position.y + g.offsetY;
    const z = root.position.z ?? 0;
    this.group.position.set(x, y, z); this.group.scale.setScalar(scale);
    this.center.visible = !intro; this.introCenter.visible = intro;
    this.center.scale.setScalar(root.scale?.x ?? 1);
    // Совпадает с плоскостью окружности Plotter и остаётся крупным, когда знак ещё мал.
    this.introCenter.position.z = (-.08 - z) / scale;
    this.introCenter.scale.setScalar(config.rings.radius);
    const draw = g.timingMode === 'custom' ? customTextAnimation(time, config.timeline, {
      effectStart: g.timingStart, effectEnd: g.timingEnd, effectFade: g.timingFade,
    }, 'effect').outline : intro ? introGuidesProgress(phase, config.timeline) : Math.min(1, Math.max(0, phase.reveal * 3));
    for (const line of [this.center, this.introCenter, this.crosses.left, this.crosses.right]) {
      const count = line.geometry.getAttribute('position').count;
      line.geometry.setDrawRange(0, Math.floor(draw * count / 2) * 2);
    }
    this.material.color.set(g.color); this.material.opacity = g.opacity * visibility;
    for (const side of ['left', 'right']) {
      this.crosses[side].visible = config.rings.enabled && ringSideVisible(config.rings, side);
      this.crosses[side].position.set((corners[side].x - x) / scale, (corners[side].y - y) / scale, (.02 - z) / scale);
    }
  }
}
