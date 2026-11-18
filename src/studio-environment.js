import * as THREE from "three";

/**
 * Студийное окружение для золота: не «коробка» RoomEnvironment, а тёмная
 * комната с тремя длинными софтбоксами. Такие источники дают на металле
 * вытянутые блики с чёткой границей — именно они читаются как «дорогое»
 * золото на большом экране. Карта строится процедурно, без внешних ассетов,
 * поэтому экспорт остаётся детерминированным.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {{warmth?: number, intensity?: number}} [options]
 * @returns {THREE.Texture}
 */
export function createStudioEnvironment(renderer, { warmth = 1, intensity = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const panel = (width, height, position, rotation, color, strength, map = null) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color[0], color[1], color[2]).multiplyScalar(strength),
      map,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    scene.add(mesh);
    return mesh;
  };

  // Большой мягкий фронтальный софтбокс с вертикальным градиентом: держит базу
  // лица тёплой и даёт мягкое скольжение отражения по выпуклой грани.
  // Он шире кадра — границ не видно.
  panel(16, 9, [0, 1.0, 8.0], [0, 0, 0], [1.0, 1.0, 1.0], 2.1 * intensity * warmth, verticalGradientTexture([
    [0, [255, 247, 228]], [0.45, [255, 226, 186]], [0.72, [226, 181, 128]], [1, [108, 78, 48]],
  ]));
  // Тёплый ключевой софтбокс сверху-спереди: узкий блик по верхним кромкам.
  panel(7.2, 2.4, [0.4, 5.6, 2.2], [-Math.PI / 2.35, 0, 0], [1.0, 0.80, 0.52], 6.0 * intensity * warmth);
  // Узкая вертикальная полоса слева: длинный блик по фаске и боковым граням.
  panel(0.75, 6.0, [-5.2, 0.6, 1.6], [0, Math.PI / 2.15, 0], [1.0, 0.72, 0.40], 2.6 * intensity * warmth);
  // Вторая полоса справа, холоднее и слабее: разделяет золото и фон.
  panel(0.5, 4.2, [5.0, 0.2, 0.9], [0, -Math.PI / 2.2, 0], [0.86, 0.82, 0.74], 1.2 * intensity);
  // Низкий тёплый отражатель: подсвечивает нижние грани, чтобы они не проваливались в чёрный.
  panel(6.0, 2.6, [0, -3.8, 1.8], [Math.PI / 2.25, 0, 0], [1.0, 0.58, 0.28], 0.95 * intensity * warmth);
  // Небольшой яркий источник для узкого «игольчатого» блика на скосе.
  panel(0.35, 0.35, [-2.6, 3.4, 3.2], [0, 0, 0], [1.0, 0.94, 0.82], 22 * intensity);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  for (const child of scene.children) {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.map?.dispose();
      child.material.dispose();
    }
  }
  return target.texture;
}

/**
 * Вертикальный градиент без canvas: работает и в браузере, и в тестах.
 * Используется как карта софтбокса, поэтому свет на металле меняется сверху вниз.
 * @param {Array<[number, [number, number, number]]>} stops
 */
function verticalGradientTexture(stops) {
  const width = 8, height = 256;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const span = Math.max(1e-6, b[0] - a[0]);
    const k = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * k);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
