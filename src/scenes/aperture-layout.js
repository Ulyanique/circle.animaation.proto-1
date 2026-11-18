const TAU = Math.PI * 2;
/** Контур кольца и шести движущихся лопастей: от закрытого к открытому отверстию.
 * @param {number} [opening] */
export function apertureSegments(opening = 0) {
  const k = Math.max(0, Math.min(1, opening));
  const innerRadius = .035 + .80 * k;
  const twist = .52 - .45 * k;
  /** @type {number[]} */
  const points = [];
  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  const add = (x1, y1, x2, y2) => points.push(x1, y1, 0, x2, y2, 0);
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const a = i * TAU / steps, b = (i + 1) * TAU / steps;
    add(Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b));
  }
  for (let blade = 0; blade < 6; blade++) {
    const a = blade * TAU / 6;
    const outer = { x: Math.cos(a), y: Math.sin(a) };
    const innerAngle = a + twist, endAngle = a + TAU / 6;
    const inner = { x: innerRadius * Math.cos(innerAngle), y: innerRadius * Math.sin(innerAngle) };
    const end = { x: innerRadius * Math.cos(endAngle + twist), y: innerRadius * Math.sin(endAngle + twist) };
    const subdivisions = 18;
    for (let i = 0; i < subdivisions; i++) {
      const t = i / subdivisions, u = (i + 1) / subdivisions;
      add(outer.x + (inner.x - outer.x) * t, outer.y + (inner.y - outer.y) * t,
        outer.x + (inner.x - outer.x) * u, outer.y + (inner.y - outer.y) * u);
    }
    for (let i = 0; i < subdivisions; i++) {
      const t = i / subdivisions, u = (i + 1) / subdivisions;
      add(inner.x + (end.x - inner.x) * t, inner.y + (end.y - inner.y) * t,
        inner.x + (end.x - inner.x) * u, inner.y + (end.y - inner.y) * u);
    }
  }
  return new Float32Array(points);
}
/** Апертура завершает раскрытие до того, как начнётся контур логотипа.
 * @param {{local:number,beforeStart:boolean}} phase @param {{drawDuration:number}} tl */
export function apertureCue(phase, tl) {
  if (phase.beforeStart) return { open: 0, opacity: 0 };
  const d = Math.max(.1, tl.drawDuration), t = phase.local;
  /** @param {number} x */
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  return { open: smooth(t / (d * .62)), opacity: smooth(t / (d * .12)) * (1 - smooth((t - d * .68) / (d * .37))) };
}
