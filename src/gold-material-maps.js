import * as THREE from "three";

/**
 * Процедурные карты материала золота (P0-4): мелкая неоднородность
 * шероховатости и тонкий микрорельеф шлифовки без внешних ассетов.
 * Полностью детерминированы по координатам текселя: повторный рендер
 * и перемотка дают побитово одинаковые значения.
 */

export const METAL_ROUGHNESS_MIN = 0.2;
export const METAL_ROUGHNESS_MAX = 0.35;
export const LOGO_BEVEL_SEGMENTS = 10;
export const LOGO_BEVEL_WIDTH_RATIO = 0.90; // +12.5% к прежней ширине фаски 0.80

/** Чистый детерминированный хеш целых координат (периодичен по size). */
function texHash(ix, iy, size, seed) {
  const x = ((ix % size) + size) % size;
  const y = ((iy % size) + size) % size;
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileNoise(fx, fy, period, seed) {
  const px = fx * period;
  const py = fy * period;
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const tx = px - x0, ty = py - y0;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  const a = texHash(x0, y0, period, seed);
  const b = texHash(x0 + 1, y0, period, seed);
  const c = texHash(x0, y0 + 1, period, seed);
  const d = texHash(x0 + 1, y0 + 1, period, seed);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

function tileFbm(u, v, basePeriod, seed) {
  let sum = 0, amp = 0.5, norm = 0, p = basePeriod;
  for (let o = 0; o < 4; o++) {
    sum += amp * tileNoise(u, v, p, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

/**
 * Создаёт пару тайлящихся карт:
 * - roughnessMap: значения в зелёном канале лежат в [0.20..0.35] (при умножении
 *   на базовый roughness материала Three.js сохраняет среднюю шероховатость,
 *   если нормировать карту вокруг ~1 или передавать реальный диапазон 0.20..0.35
 *   вместе с базовым множителем). Чтобы ползунок `logo.roughness` сохранял смысл
 *   средней шероховатости (по умолчанию 0.34 → разброс ~0.23..0.38, а сама карта
 *   имеет паспортный разброс 0.20..0.35 при нормализации), храним значения
 *   вокруг среднего ~0.81 (диапазон байтов 168..244, т.е. 0.66..0.96 множителя:
 *   при roughness=0.34 эффективная шероховатость как раз ~0.22..0.33).
 * - normalMap: тонкий микрорельеф 0.5–1 px (горизонтальная ювелирная шлифовка +
 *   мягкое зерно литья) в пространстве касательных.
 *
 * @param {number} [size=256]
 */
export function createGoldSurfaceMaps(size = 256) {
  const n = Math.max(16, size | 0);
  const roughBytes = new Uint8Array(n * n * 4);
  const heightField = new Float32Array(n * n);

  for (let y = 0; y < n; y++) {
    const v = y / n;
    for (let x = 0; x < n; x++) {
      const u = x / n;
      // Анизотропная протяжка шлифовки вдоль X + мягкая пятнистость полировки.
      const grain = tileFbm(u, v, 8, 11);
      const streak = tileNoise(u * 0.25, v, 32, 53) * 0.65 + tileNoise(u * 0.5, v, 64, 79) * 0.35;
      const micro = tileNoise(u, v, 64, 131);

      // Значение в [0..1] → переводим в физический коридор шероховатости 0.20..0.35,
      // нормированный к штатному roughness=0.34 (множитель ~0.64..1.00), чтобы
      // ползунок шероховатости в UI продолжал работать предсказуемо.
      const t = Math.min(1, Math.max(0, grain * 0.52 + streak * 0.34 + micro * 0.14));
      const physical = METAL_ROUGHNESS_MIN + (METAL_ROUGHNESS_MAX - METAL_ROUGHNESS_MIN) * t;
      const factor = Math.min(1, Math.max(0, physical / 0.35));
      const byte = Math.round(factor * 255);
      const idx = (y * n + x) * 4;
      roughBytes[idx] = byte;
      roughBytes[idx + 1] = byte; // Three.js читает G-канал roughnessMap
      roughBytes[idx + 2] = byte;
      roughBytes[idx + 3] = 255;

      // Поле высот для 0.5–1 px микрорельефа: тонкие штрихи + плавная волнистость.
      heightField[y * n + x] = (streak - 0.5) * 0.55 + (grain - 0.5) * 0.30 + (micro - 0.5) * 0.15;
    }
  }

  const normalBytes = new Uint8Array(n * n * 4);
  // Масштаб градиента подобран под мягкий рельеф ~0.5–1 px без зернистого пересвета.
  const slopeScale = 1.35;
  for (let y = 0; y < n; y++) {
    const ym = ((y - 1) + n) % n;
    const yp = (y + 1) % n;
    for (let x = 0; x < n; x++) {
      const xm = ((x - 1) + n) % n;
      const xp = (x + 1) % n;
      const dx = (heightField[y * n + xp] - heightField[y * n + xm]) * slopeScale;
      const dy = (heightField[yp * n + x] - heightField[ym * n + x]) * slopeScale;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const idx = (y * n + x) * 4;
      normalBytes[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalBytes[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalBytes[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalBytes[idx + 3] = 255;
    }
  }

  const configure = (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  };

  const roughnessMap = configure(new THREE.DataTexture(roughBytes, n, n, THREE.RGBAFormat));
  const normalMap = configure(new THREE.DataTexture(normalBytes, n, n, THREE.RGBAFormat));
  return { roughnessMap, normalMap, size: n, roughBytes, normalBytes };
}

/**
 * Геометрия и материал янтарной вставки (кабошона) в круглом окне оголовка циркуля.
 * Размещается в локальных SVG-координатах `Logo.body` точно по отверстию первой фигуры,
 * не выходит за лицевую фаску и проявляется тем же фронтом `uReveal`.
 *
 * @param {{shapes: THREE.Shape[], cx: number, cy: number, K: number}} parsed
 * @param {(mat: any) => any} [patchMaterial]
 * @param {(mat: any) => any} [patchDepth]
 */
export function findMedallionHole(parsed) {
  const head = parsed.shapes[0];
  const hole = head?.holes?.[0];
  if (!hole) return null;
  const pts = hole.getPoints(48);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return {
    cx: (minX + maxX) / 2 - parsed.cx,
    cy: (minY + maxY) / 2 - parsed.cy,
    rx: (maxX - minX) / 2,
    ry: (maxY - minY) / 2,
  };
}
