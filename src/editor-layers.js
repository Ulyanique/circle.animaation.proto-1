import { DECOR_SLOTS } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';
import { CUSTOM_TEXT_IDS, customTextOrder } from './custom-text.js';

/** Реестр редактируемых элементов готовых шаблонов. Это пока не произвольные слои. */
export const EDITOR_LAYERS = [
  { id: 'logo', label: 'Логотип', kind: 'Знак', visibility: { section: 'logo', key: 'visible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'title', label: 'Название', kind: 'Текст', visibility: { section: 'caption', key: 'titleVisible' }, scenes: ['waiting', 'brand', 'finale'] },
  { id: 'subtitle', label: 'Подзаголовок', kind: 'Текст', visibility: { section: 'caption', key: 'subtitleVisible' }, scenes: ['waiting', 'finale'] },
  { id: 'date', label: 'Дата', kind: 'Текст', visibility: { section: 'caption', key: 'dateVisible' }, scenes: ['waiting'] },
  { id: 'ringLeft', label: 'Левый круг и свет', kind: 'Эффект', visibility: { section: 'rings', key: 'leftVisible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'ringRight', label: 'Правый круг и свет', kind: 'Эффект', visibility: { section: 'rings', key: 'rightVisible' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'constructionGuides', label: 'Чертёжные линии', kind: 'Эффект', visibility: { section: 'constructionGuides', key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'topIllumination', label: 'Верхний свет и ореол', kind: 'Эффект', visibility: { section: 'topIllumination', key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] },
  { id: 'photoLabel', label: 'Надпись по кругу', kind: 'Текст', visibility: { section: 'photo', key: 'textEnabled' }, scenes: ['brand', 'photo-pause'] },
  { id: 'photoAperture', label: 'Апертура объектива', kind: 'Эффект', visibility: { section: 'photo', key: 'apertureEnabled' }, scenes: ['photo-pause'] },
  ...DECOR_SLOTS.map(({id, section}, index) => ({ id, label: `Построительная окружность ${index + 1}`, kind: 'Декор', optional: true, presenceSection: section, visibility: { section, key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] })),
  ...PARTICLE_CLOUD_IDS.map((id, index) => ({ id, label: `Облако частиц ${index + 1}`, kind: 'Эффект', optional: true, presenceSection: id, visibility: { section: id, key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] })),
  ...BACKGROUND_GLOW_IDS.map((id, index) => ({ id, label: `Фоновое свечение ${index + 1}`, kind: 'Эффект', optional: true, presenceSection: id, visibility: { section: id, key: 'enabled' }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] })),
  ...CUSTOM_TEXT_IDS.map((id, i) => ({ id, label: `Текст ${i + 1}`, kind: 'Текст', custom: true,
    visibility: { section: 'textLayers', key: `${id}Visible` }, scenes: ['waiting', 'brand', 'photo-pause', 'finale'] })),
];
export function layersForScene(id, config) {
  const available = EDITOR_LAYERS.filter(layer => layer.scenes.includes(id) && (!layer.custom || config?.textLayers?.[`${layer.id}Present`] === true) && (!layer.optional || (config ? config[layer.presenceSection || 'decor']?.present === true : layer.id === 'brandDecor' && id === 'brand')));
  const customs = customTextOrder(config?.textLayers, true).reverse().map(key => available.find(layer => layer.id === key)).filter(Boolean);
  return [...available.filter(layer => !layer.custom), ...customs];
}

/** Место под панели редактора; пропорции самого кадра не меняются. */
export function editorViewport(width, height, editing) {
  if (!editing) return { left: 0, top: 0, width, height };
  const wide = width > 780;
  const left = wide ? 196 : 8, right = wide ? 246 : 8;
  const top = wide ? 68 : 100;
  const bottom = wide ? 140 + Math.min(130, height * 0.16) : Math.min(175, height * 0.32) + Math.min(120, height * 0.16);
  return { left, top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) };
}

/** Отсутствующий флаг в старых настройках означает видимый элемент. */
export function layerVisible(config, layer) {
  if ((layer.id === 'ringLeft' || layer.id === 'ringRight') && config.rings?.enabled === false) return false;
  return config[layer.visibility.section]?.[layer.visibility.key] !== false;
}
