/** Позиции редактора совпадают с диапазонами полей панели настроек. */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function moveLogo(start, dx, dy) {
  return { x: clamp(start.x + dx, -2, 2), y: clamp(start.y + dy, -2, 2) };
}
export function moveTitle(start, dx, dy, width, height) {
  if (!(width > 0 && height > 0)) return { ...start };
  return { x: clamp(start.x + dx / width, -0.45, 0.45), y: clamp(start.y + dy / height, -0.45, 0.45) };
}
