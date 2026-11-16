import { createSharedSceneConfig } from './shared-visuals.js';
import { createSceneTimeline } from './scene-timeline.js';

// Отдельная сцена с логотипами из предоставленных SVG.
export const PARTNERS_DEFAULTS = createSharedSceneConfig(createSceneTimeline(20));
PARTNERS_DEFAULTS.transition = {duration:.9};
PARTNERS_DEFAULTS.partners = {
  title: 'ЯНТАРНЫЙ ЦИРКУЛЬ', subtitle: 'Вечер ретроспектива',
  organizerLabel: 'ОРГАНИЗАТОР', coorganizerLabel: 'СООРГАНИЗАТОР', organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит',
  partnerLabel: 'СПОНСОРЫ', partner1: 'Промрукав', partner2: 'КЭАЗ',
  frameVisible: true, curtainVisible: true, particlesVisible: true, shimmerVisible: true, foliageVisible: true, compassVisible: true, motion: 1,
};
