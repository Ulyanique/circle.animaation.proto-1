/** Геометрия рабочего пространства не входит в настройки сцен и экспорт. */
let preferred = { layers: null, inspector: null };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function workspaceWidths(width) {
  const studio = width >= 1200;
  const defaults = { layers: studio ? 220 : 176, inspector: studio ? 270 : 226 };
  if (width <= 780) return defaults;
  // Оставляем между панелями не менее 320px под композицию и зазоры по 20px.
  const layers = clamp(preferred.layers ?? defaults.layers, 160, Math.min(420, width - 360 - 200));
  const inspector = clamp(preferred.inspector ?? defaults.inspector, 200, Math.min(440, width - 360 - layers));
  return { layers, inspector };
}
export function setWorkspaceWidth(side, value, width) {
  if (width <= 780 || !Number.isFinite(value)) return;
  const current = workspaceWidths(width);
  const other = side === 'layers' ? current.inspector : current.layers;
  const min = side === 'layers' ? 160 : 200;
  const max = Math.min(side === 'layers' ? 420 : 440, width - 360 - other);
  preferred[side] = clamp(value, min, max);
}
export function resetWorkspaceWidth(side) { preferred[side] = null; }

/** Синхронизирует DOM-панели с той же геометрией, что используется сценой. */
export function applyEditorWorkspace(width, height, editing, view) {
  if (!editing || width <= 780) return;
  const widths = workspaceWidths(width);
  const style = document.documentElement.style;
  style.setProperty('--workspace-layers', `${widths.layers}px`);
  style.setProperty('--workspace-inspector', `${widths.inspector}px`);
  // Поддерживаем тот же масштаб 16:9, что и canvas, включая округление CSS.
  const frameHeight = Math.round(Math.min(view.width, view.height * 16 / 9) * 9 / 16);
  const frameBottom = view.top + view.height / 2 + frameHeight / 2;
  style.setProperty('--workspace-timeline-top', `${Math.ceil(frameBottom + 6)}px`);
  for (const side of ['layers', 'inspector']) {
    const handle = document.querySelector(`[data-workspace-resize="${side}"]`);
    if (!handle) continue;
    const other = side === 'layers' ? widths.inspector : widths.layers;
    handle.setAttribute('aria-valuemin', String(side === 'layers' ? 160 : 200));
    handle.setAttribute('aria-valuemax', String(Math.min(side === 'layers' ? 420 : 440, width - 360 - other)));
    handle.setAttribute('aria-valuenow', String(Math.round(widths[side])));
    handle.setAttribute('aria-valuetext', `${Math.round(widths[side])} пикселей`);
  }
}
