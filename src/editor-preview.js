/** Локальный масштаб просмотра. Не меняет координаты сцены и сбрасывается при выходе из редактора. */
let zoom = 1, panX = 0, panY = 0;
export const PREVIEW_ZOOMS = [.5, .75, 1, 1.25, 1.5, 2, 3, 4];
export function previewState() { return {zoom, panX, panY}; }
export function resetPreview() { zoom = 1; panX = panY = 0; }
export function setPreviewZoom(value) {
  if (!Number.isFinite(value)) return;
  const next = Math.min(4, Math.max(.5, value));
  panX *= next / zoom; panY *= next / zoom; zoom = next;
  if (zoom <= 1) panX = panY = 0;
}
export function panPreview(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  panX = x; panY = y;
}
/** Размер окна композиции остаётся неизменным; увеличение обрезается по его границе. */
export function previewLayout(view, editing) {
  const fitWidth = Math.min(view.width, view.height * 16 / 9);
  const fitHeight = fitWidth * 9 / 16;
  const centerX = view.left + view.width / 2, centerY = view.top + view.height / 2;
  const scale = editing ? zoom : 1;
  if (editing) {
    const maxX = Math.max(0, (fitWidth * scale - fitWidth) / 2);
    const maxY = Math.max(0, (fitHeight * scale - fitHeight) / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  }
  return {fitWidth, fitHeight, centerX: centerX + (editing ? panX : 0), centerY: centerY + (editing ? panY : 0),
    width: fitWidth * scale, height: fitHeight * scale,
    clip: {left: centerX - fitWidth / 2, top: centerY - fitHeight / 2, width: fitWidth, height: fitHeight}};
}
/** Обрезка только CSS-предпросмотра; прямоугольник DOM сохраняет размер полной композиции. */
export function applyPreviewLayout(view, editing, canvas, cap) {
  const p = previewLayout(view, editing);
  const w = Math.round(p.width), h = Math.round(p.height);
  const left = p.centerX - w / 2, top = p.centerY - h / 2;
  const c = p.clip;
  const inset = editing ? `inset(${Math.max(0, c.top - top)}px ${Math.max(0, left + w - c.left - c.width)}px ${Math.max(0, top + h - c.top - c.height)}px ${Math.max(0, c.left - left)}px)` : '';
  for (const el of [canvas, cap]) {
    if (!el) continue;
    el.style.left = `${p.centerX}px`; el.style.top = `${p.centerY}px`;
    el.style.width = `${w}px`; el.style.height = `${h}px`;
    el.style.clipPath = inset;
  }
  if (cap) cap.style.setProperty('--u', `${p.width / 100}px`);
  const clip = document.querySelector('.editor-preview-clip');
  if (clip) {
    clip.style.clipPath = editing ? `inset(${Math.max(0, c.top)}px ${Math.max(0, innerWidth - c.left - c.width)}px ${Math.max(0, innerHeight - c.top - c.height)}px ${Math.max(0, c.left)}px)` : '';
  }
  return p;
}
