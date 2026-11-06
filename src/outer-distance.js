// Заполняем внутренние отверстия, оставляя только фон, соединённый с краем.
// Затем строим точное евклидово расстояние до объединённого внешнего силуэта.
export function exteriorDistance(alpha, width, height) {
  const size = width * height;
  const exterior = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0, tail = 0;
  function push(index) {
    if (!exterior[index] && !alpha[index]) { exterior[index] = 1; queue[tail++] = index; }
  }
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width, y = Math.floor(i / width);
    if (x > 0) push(i - 1);
    if (x + 1 < width) push(i + 1);
    if (y > 0) push(i - width);
    if (y + 1 < height) push(i + width);
  }

  // Линейный по числу пикселей двумерный distance transform (квадрат расстояния).
  const inf = 1e15;
  const work = new Float64Array(size);
  const result = new Float32Array(size);
  const maxDim = Math.max(width, height);
  const f = new Float64Array(maxDim), d = new Float64Array(maxDim);
  const v = new Int32Array(maxDim), z = new Float64Array(maxDim + 1);
  function edt(n) {
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s;
      do {
        const p = v[k];
        s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * (q - p));
        if (s <= z[k]) k--; else break;
      } while (k >= 0);
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const delta = q - v[k];
      d[q] = delta * delta + f[v[k]];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = exterior[y * width + x] ? inf : 0;
    edt(width);
    for (let x = 0; x < width; x++) work[y * width + x] = d[x];
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = work[y * width + x];
    edt(height);
    for (let y = 0; y < height; y++) result[y * width + x] = Math.sqrt(d[y]);
  }
  return result;
}

/** Упаковка расстояния в два 8-битных канала для тонких, плавных линий. */
export function packDistances(distances, maxDistance) {
  const pixels = new Uint8Array(distances.length * 4);
  for (let i = 0; i < distances.length; i++) {
    const value = Math.round(Math.min(1, Math.max(0, distances[i] / maxDistance)) * 65535);
    pixels[i * 4] = value >> 8;
    pixels[i * 4 + 1] = value & 255;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
