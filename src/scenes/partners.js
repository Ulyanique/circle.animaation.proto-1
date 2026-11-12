import { createSharedSceneConfig } from './shared-visuals.js';
import { createSceneTimeline } from './scene-timeline.js';

// Отдельная сцена с временными названиями вместо не предоставленных логотипов.
export const PARTNERS_DEFAULTS = createSharedSceneConfig(createSceneTimeline(20));
PARTNERS_DEFAULTS.transition = {duration:.9};
PARTNERS_DEFAULTS.partners = {
  title: 'Янтарный циркуль', subtitle: 'Вечер ретроспектива',
  organizerLabel: 'ОРГАНИЗАТОР', organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит',
  partnerLabel: 'ПАРТНЁРЫ', partner1: 'Промрукав', partner2: 'КЭАЗ',
  frameVisible: true, curtainVisible: true, foliageVisible: true, compassVisible: true, motion: 1,
};
