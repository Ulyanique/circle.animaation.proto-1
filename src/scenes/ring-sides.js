/** Позиция двух исходных групп; смещения независимы и не меняют старые JSON. */
/** @param {"left"|"right"} side @param {any} rings @param {number} halfW @param {number} halfH */
export function ringSidePosition(side, rings, halfW, halfH) {
  const left = side === 'left';
  return {
    x: (left ? -1 : 1) * halfW * rings.cornerX * 2 + (rings[`${side}OffsetX`] ?? 0),
    y: (left ? 1 : -1) * halfH * rings.cornerY * 2 + (rings[`${side}OffsetY`] ?? 0),
  };
}
/** @param {any} rings @param {"left"|"right"} side */
export function ringSideVisible(rings, side) { return rings[`${side}Visible`] !== false; }
/** @param {any} rings @param {"left"|"right"} side */
export function ringSideScale(rings, side) { return rings[`${side}Scale`] ?? 1; }
