import * as THREE from "three";
import { CONTOUR_WAVE_COUNT, contourWave } from "./scenes/cues.js";

/** Полупрозрачные эхо настоящего SVG-контура, расходящиеся за логотипом. */
export class ContourWaves {
  constructor(logo) {
    this.logo = logo;
    this.group = new THREE.Group();
    this.group.name = "contour-waves";
    this.layers = [];
    for (let index = 0; index < CONTOUR_WAVE_COUNT; index++) {
      // Геометрия та же, что у рисующегося контура; каждой волне нужен свой alpha.
      const material = logo.outlineMat.clone();
      material.uniforms.uRes = logo.outlineU.uRes;
      material.uniforms.uDraw.value = 1.5;
      material.uniforms.uReverse.value = 0;
      material.uniforms.uRetire.value = 0;
      material.uniforms.uWidth.value = 0.75;
      material.uniforms.uOpacity.value = 0;
      material.uniforms.uCaptionSafe.value = 1;
      material.uniforms.uHeadColor.value.set(0x000000);
      const line = new THREE.Mesh(logo.outlineGeo, material);
      line.frustumCulled = false;
      line.scale.set(logo.parsed.K, -logo.parsed.K, logo.parsed.K);
      const layer = new THREE.Group();
      layer.add(line);
      this.group.add(layer);
      this.layers.push({ layer, material });
    }
  }

  update(time, phase, cfg) {
    const root = this.logo.root;
    // По мере проявления знака волны мягко появляются; на уходе гаснут вместе со светом.
    const visibility = THREE.MathUtils.smoothstep(phase.reveal, 0.45, 1) * phase.rings;
    this.group.visible = cfg.logo.outlineEnabled && visibility > 0.001;
    if (!this.group.visible) return;
    this.group.position.set(root.position.x, root.position.y, root.position.z - 0.7);
    this.group.rotation.set(root.rotation.x * 0.4, root.rotation.y * 0.4, 0);
    for (let index = 0; index < this.layers.length; index++) {
      const { layer, material } = this.layers[index];
      const wave = contourWave(time, index);
      // Компенсируем перспективное уменьшение, поскольку эхо лежит за символом.
      layer.scale.setScalar(root.scale.x * wave.scale * 1.08);
      material.uniforms.uColor.value.set(cfg.logo.outlineColor);
      material.uniforms.uOpacity.value = wave.opacity * visibility;
      layer.visible = material.uniforms.uOpacity.value > 0.001;
    }
  }

  dispose() {
    this.group.removeFromParent();
    // outlineGeo принадлежит Logo и освобождается вместе с ним.
    for (const { material } of this.layers) material.dispose();
  }
}
