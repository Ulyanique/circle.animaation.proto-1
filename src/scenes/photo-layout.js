/** Геометрия букв вдоль окружности, без привязки к DOM или частоте кадров.
 * @param {string} text @param {number} repeats @param {number} radius
 * @param {(glyph:string) => number} measure */
export function circularGlyphLayout(text, repeats, radius, measure) {
  const phrase = (String(text || 'ФОТОПАУЗА').trim() || 'ФОТОПАУЗА').toLocaleUpperCase('ru') + ' • ';
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ru', { granularity: 'grapheme' }) : null;
  const glyphs = segmenter ? [...segmenter.segment(phrase)].map(p => p.segment) : Array.from(phrase);
  const count = Math.max(1, Math.min(8, Math.round(repeats)));
  const all = Array.from({ length: count }, () => glyphs).flat();
  const widths = all.map(measure);
  const circumference = Math.PI * 2 * Math.max(radius, 0.01);
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, circumference * 0.93 / Math.max(total, 0.01));
  const spacing = (circumference - total * scale) / all.length;
  let cursor = -Math.PI / 2;
  return all.map((glyph, i) => {
    const advance = (widths[i] * scale + spacing) / radius;
    const angle = cursor + advance / 2;
    cursor += advance;
    return { glyph, angle, scale };
  });
}

/** Уголки в координатах камеры; находятся на одинаковом расстоянии от границ кадра.
 * @param {number} halfW @param {number} halfH @param {number} margin @param {number} length */
export function viewfinderSegments(halfW, halfH, margin, length) {
  const x = halfW * (1 - 2 * margin), y = halfH * (1 - 2 * margin);
  const arm = halfH * 2 * length;
  const vertices = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    vertices.push(sx * x, sy * y, 0, sx * (x - arm), sy * y, 0);
    vertices.push(sx * x, sy * y, 0, sx * x, sy * (y - arm), 0);
  }
  return vertices;
}
