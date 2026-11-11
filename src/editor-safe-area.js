/** Рамка 5% — ориентир для проверки композиции, не гарантия требований площадки.
 * @param {{left:number,top:number,width:number,height:number}} frame
 * @param {number} margin */
export function safeArea(frame, margin = .05) {
  const m = Math.min(.45, Math.max(0, margin));
  return {left:frame.left + frame.width * m, top:frame.top + frame.height * m,
    width:frame.width * (1 - 2 * m), height:frame.height * (1 - 2 * m)};
}
/** Проверяет ограничивающий прямоугольник текста, а не его отдельные пиксели.
 * @param {{left:number,top:number,width:number,height:number}} bounds
 * @param {{left:number,top:number,width:number,height:number}} frame */
export function textBoundsStatus(bounds, frame) {
  if (!(frame.width > 0 && frame.height > 0 && bounds.width > 0 && bounds.height > 0)) return 'unknown';
  const contains = (outer, inner) => inner.left >= outer.left - .5 && inner.top >= outer.top - .5 &&
    inner.left + inner.width <= outer.left + outer.width + .5 && inner.top + inner.height <= outer.top + outer.height + .5;
  if (!contains(frame, bounds)) return 'outside';
  return contains(safeArea(frame), bounds) ? 'safe' : 'margin';
}
