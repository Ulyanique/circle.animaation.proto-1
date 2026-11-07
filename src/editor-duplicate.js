import { CUSTOM_TEXT_IDS, customTextKeys, customTextInsertion } from './custom-text.js';
import { DECOR_IDS, decorSection } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';

const effectGroups = [DECOR_IDS, PARTICLE_CLOUD_IDS, BACKGROUND_GLOW_IDS];
const sectionFor = id => decorSection(id) || id;

/** Сдвиг к свободному соседнему месту, с учётом границ редактора. */
function shifted(value, step, min, max) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  // Не притягиваем к границе сохранённые координаты за пределами слайдера.
  if (n < min || n > max) return n + step;
  const candidate = n + step;
  return Math.max(min, Math.min(max, candidate < min || candidate > max ? n - step : candidate));
}

export function canDuplicate(id) {
  return CUSTOM_TEXT_IDS.includes(id) || effectGroups.some(group => group.includes(id));
}

/** Найти свободный слот того же типа, не затрагивая исходный слой. */
export function duplicateTarget(config, id) {
  if (CUSTOM_TEXT_IDS.includes(id)) return CUSTOM_TEXT_IDS.find(key => config.textLayers?.[`${key}Present`] !== true) ?? null;
  const group = effectGroups.find(ids => ids.includes(id));
  return group?.find(key => config[sectionFor(key)]?.present !== true) ?? null;
}

/** План точечных правок для атомарного undo/redo. Параметры исходника не меняются. */
export function duplicatePlan(config, defaults, id) {
  const target = duplicateTarget(config, id);
  if (!target) return null;
  if (CUSTOM_TEXT_IDS.includes(id)) {
    const values = config.textLayers;
    const changes = customTextKeys(target).map(key => {
      const suffix = key.slice(target.length);
      let value = values[`${id}${suffix}`];
      if (suffix === 'Present') value = true;
      if (suffix === 'Order') value = customTextInsertion(values, target).at(-1).value;
      if (suffix === 'X' || suffix === 'Y') value = shifted(value, 0.025, -0.45, 0.45);
      return {section: 'textLayers', key, value};
    });
    changes.push(...customTextInsertion(values, target).slice(0, -1));
    return {target, changes};
  }
  const source = sectionFor(id), section = sectionFor(target), values = config[source];
  const changes = Object.keys(defaults[section]).map(key => {
    let value = values[key];
    if (key === 'present') value = true;
    if (key === 'offsetX') value = shifted(value, 0.25, -10, 10);
    if (key === 'offsetY') value = shifted(value, -0.2, -10, 10);
    return {section, key, value};
  });
  return {target, changes};
}
