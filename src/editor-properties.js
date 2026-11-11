import { SCHEMA } from './config.js';
import { decorSection } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';

/** Дополнительные настройки, относящиеся к выбранному слою. Геометрия и основные поля уже в инспекторе. */
export function inspectorProperties(id, sceneId, config) {
  const specs = [];
  const add = (section, accept, shared = false) => {
    const schema = SCHEMA.find(s => s.id === section);
    if (!schema || !config[section]) return;
    for (const field of schema.fields) if (field.key in config[section] && accept(field.key))
      specs.push({section, field, shared});
  };
  if (id === 'logo') {
    add('logo', k => !['visible','scale','offsetX','offsetY'].includes(k) && !(sceneId !== 'brand' && ['swayAmount','swaySpeed'].includes(k)));
    add('colors', k => ['goldHighlight','goldDeep'].includes(k), true);
  } else if (['title','subtitle','date'].includes(id)) {
    add('caption', k => k === `${id}AutoFit`);
    add('typography', k => k === 'font' || k === `${id}Tracking`, true);
    if (id === 'subtitle' && sceneId === 'finale') add('finale', k => k.startsWith('subtitle'), true);
  } else if (id === 'ringLeft' || id === 'ringRight') {
    add('rings', k => !/^(left|right)/.test(k), true);
    add('particles', () => true, true);
  } else if (id === 'photoLabel') {
    add('photo', k => ['repeats','fontSize','rotationSpeed','textOpacity'].includes(k));
  } else if (id === 'photoAperture') {
    add('photo', k => ['apertureOpacity'].includes(k));
  } else {
    const section = decorSection(id) || (PARTICLE_CLOUD_IDS.includes(id) || BACKGROUND_GLOW_IDS.includes(id) ? id : id === 'constructionGuides' || id === 'topIllumination' ? id : null);
    if (section) add(section, k => !['present','enabled','offsetX','offsetY','radius','scale','color','intensity','dustOpacity'].includes(k) && (k !== 'opacity' || section === 'constructionGuides'));
    if (id === 'topIllumination') add('lights', k => k === 'topGlow', true);
  }
  return specs;
}
