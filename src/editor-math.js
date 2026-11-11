/** Позиции редактора совпадают с диапазонами полей панели настроек. */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function moveLogo(start, dx, dy) {
  return { x: clamp(start.x + dx, -2, 2), y: clamp(start.y + dy, -2, 2) };
}
/** Перемещение абсолютного смещения с отдельной границей. */
export function moveWorldOffset(start, dx, dy, limit = 10) {
  return { x: clamp(start.x + dx, -limit, limit), y: clamp(start.y + dy, -limit, limit) };
}
export function moveTitle(start, dx, dy, width, height) {
  if (!(width > 0 && height > 0)) return { ...start };
  return { x: clamp(start.x + dx / width, -0.45, 0.45), y: clamp(start.y + dy / height, -0.45, 0.45) };
}

/** Притягивает края или центры прямоугольника к краям/центрам целей в экранных пикселях. */
export function snapRect(rect, dx, dy, targets, threshold = 7) {
  const find = (start, size, delta, axis) => {
    const source = [start, start + size / 2, start + size];
    let best = null;
    for (const target of targets) {
      const edge = axis === 'x' ? target.left : target.top;
      const length = axis === 'x' ? target.width : target.height;
      for (const dest of [edge, edge + length / 2, edge + length]) {
        for (const src of source) {
          const correction = dest - (src + delta);
          if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction))) {
            best = { correction, guide: dest };
          }
        }
      }
    }
    return best;
  };
  const x = find(rect.left, rect.width, dx, 'x');
  const y = find(rect.top, rect.height, dy, 'y');
  return { dx: dx + (x?.correction ?? 0), dy: dy + (y?.correction ?? 0),
    guideX: x?.guide ?? null, guideY: y?.guide ?? null };
}

/** Пропорциональный размер от расстояния указателя до центра, с границами настройки. */
export function resizeFromDistance(initial, startDistance, currentDistance, min, max) {
  if (!(startDistance > 1) || !Number.isFinite(currentDistance)) return initial;
  return clamp(initial * Math.max(0, currentDistance) / startDistance, min, max);
}
