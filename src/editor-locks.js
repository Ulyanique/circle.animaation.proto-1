import { DECOR_IDS } from './brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from './particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from './background-glow-config.js';
import { CUSTOM_TEXT_IDS } from './custom-text.js';

/** Защита редактора, не влияет на визуализацию. Старые конфиги: все разблокированы. */
export const editorLockDefaults = () => Object.fromEntries([
  'logo', 'title', 'subtitle', 'date', 'ringLeft', 'ringRight', 'constructionGuides',
  'topIllumination', 'photoLabel', 'photoAperture', ...DECOR_IDS, ...PARTICLE_CLOUD_IDS,
  ...BACKGROUND_GLOW_IDS, ...CUSTOM_TEXT_IDS,
].map(id => [id, false]));
/** @param {{editorLocks?: Record<string, boolean>}} config @param {string} id */
export const layerLocked = (config, id) => config.editorLocks?.[id] === true;
