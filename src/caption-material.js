// Shared stops keep the DOM preview and the export canvas on the same palette.
export const METALLIC_TITLE_STOPS = [
  [0, '#fff5d8'], [0.22, '#f6dfae'], [0.44, '#e0b981'],
  [0.56, '#cda367'], [0.64, '#f0d6a3'], [0.82, '#d9ac6c'], [1, '#b08245'],
];

/** A restrained warm reflection; zero reproduces the original palette exactly. */
export function metallicTitleStops(shine = 0) {
  const amount = Math.max(0, Math.min(1, shine)) * .42;
  if (amount === 0) return METALLIC_TITLE_STOPS;
  const light = [255, 234, 187];
  return METALLIC_TITLE_STOPS.map(([at, color]) => {
    const hex = /** @type {string} */ (color).slice(1);
    const rgb = [0, 2, 4].map((i, channel) => {
      const base = parseInt(hex.slice(i, i + 2), 16);
      return Math.round(base + (light[channel] - base) * amount).toString(16).padStart(2, '0');
    });
    return [at, `#${rgb.join('')}`];
  });
}

/** @param {number} [shine] */
export function metallicTitleCSS(shine = 0) {
  return `linear-gradient(180deg, ${metallicTitleStops(shine).map(([at, color]) => `${color} ${Number(at) * 100}%`).join(', ')})`;
}
export const METALLIC_TITLE_CSS = metallicTitleCSS();

/** Passing highlight follows the same absolute-time cue as the logo glint. */
export function titleGlintAtGlyph(intensity, position, index, count) {
  const x = count <= 1 ? 0 : 2 * index / (count - 1) - 1;
  return Math.max(0, Math.min(1, intensity)) * Math.exp(-Math.pow((x - position) / .32, 2));
}

/** @param {CanvasRenderingContext2D} ctx @param {number} centerY @param {number} size @param {number} [shine] */
export function metallicTitleGradient(ctx, centerY, size, shine = 0) {
  const gradient = ctx.createLinearGradient(0, centerY - size / 2, 0, centerY + size / 2);
  for (const [at, color] of metallicTitleStops(shine)) gradient.addColorStop(/** @type {number} */ (at), /** @type {string} */ (color));
  return gradient;
}
