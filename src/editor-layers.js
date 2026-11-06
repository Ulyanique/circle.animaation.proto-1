/** Реестр редактируемых элементов готовых шаблонов. Это пока не произвольные слои. */
export const EDITOR_LAYERS = [
  { id: 'logo', label: 'Логотип', kind: 'Знак', scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'title', label: 'Название', kind: 'Текст', scenes: ['waiting', 'brand', 'finale'] },
  { id: 'subtitle', label: 'Подзаголовок', kind: 'Текст', scenes: ['waiting', 'finale'] },
  { id: 'date', label: 'Дата', kind: 'Текст', scenes: ['waiting'] },
  { id: 'photoLabel', label: 'Надпись по кругу', kind: 'Текст', scenes: ['photo-pause'] },
  { id: 'brandDecor', label: 'Построительная окружность', kind: 'Декор', scenes: ['brand'] },
];
export function layersForScene(id) { return EDITOR_LAYERS.filter(layer => layer.scenes.includes(id)); }

/** Место под панели редактора; пропорции самого кадра не меняются. */
export function editorViewport(width, height, editing) {
  if (!editing) return { left: 0, top: 0, width, height };
  const wide = width >= 1000;
  const left = wide ? 220 : 8, right = wide ? 290 : 8;
  const top = wide ? 78 : 100, bottom = wide ? 140 : Math.min(175, height * 0.32);
  return { left, top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) };
}
