import { CUSTOM_TEXT_IDS } from './custom-text.js';

/** Реестр редактируемых элементов готовых шаблонов. Это пока не произвольные слои. */
export const EDITOR_LAYERS = [
  { id: 'logo', label: 'Логотип', kind: 'Знак', visibility: { section: 'logo', key: 'visible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'title', label: 'Название', kind: 'Текст', visibility: { section: 'caption', key: 'titleVisible' }, scenes: ['waiting', 'brand', 'finale'] },
  { id: 'subtitle', label: 'Подзаголовок', kind: 'Текст', visibility: { section: 'caption', key: 'subtitleVisible' }, scenes: ['waiting', 'finale'] },
  { id: 'date', label: 'Дата', kind: 'Текст', visibility: { section: 'caption', key: 'dateVisible' }, scenes: ['waiting'] },
  { id: 'ringLeft', label: 'Левый круг и свет', kind: 'Эффект', visibility: { section: 'rings', key: 'leftVisible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'ringRight', label: 'Правый круг и свет', kind: 'Эффект', visibility: { section: 'rings', key: 'rightVisible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'photoLabel', label: 'Надпись по кругу', kind: 'Текст', visibility: { section: 'photo', key: 'textEnabled' }, scenes: ['photo-pause'] },
  { id: 'brandDecor', label: 'Построительная окружность', kind: 'Декор', optional: true, visibility: { section: 'decor', key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'particleCloud', label: 'Облако частиц', kind: 'Эффект', optional: true, presenceSection: 'particleCloud', visibility: { section: 'particleCloud', key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  ...CUSTOM_TEXT_IDS.map((id, i) => ({ id, label: `Текст ${i + 1}`, kind: 'Текст', custom: true,
    visibility: { section: 'textLayers', key: `${id}Visible` }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] })),
];
export function layersForScene(id, config) {
  return EDITOR_LAYERS.filter(layer => layer.scenes.includes(id) && (!layer.custom || config?.textLayers?.[`${layer.id}Present`] === true) && (!layer.optional || (config ? config[layer.presenceSection || 'decor']?.present === true : layer.id === 'brandDecor' && id === 'brand')));
}

/** Место под панели редактора; пропорции самого кадра не меняются. */
export function editorViewport(width, height, editing) {
  if (!editing) return { left: 0, top: 0, width, height };
  const wide = width >= 1000;
  const left = wide ? 220 : 8, right = wide ? 290 : 8;
  const top = wide ? 78 : 100, bottom = wide ? 140 : Math.min(175, height * 0.32);
  return { left, top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) };
}

/** Отсутствующий флаг в старых настройках означает видимый элемент. */
export function layerVisible(config, layer) {
  if ((layer.id === 'ringLeft' || layer.id === 'ringRight') && config.rings?.enabled === false) return false;
  return config[layer.visibility.section]?.[layer.visibility.key] !== false;
}
