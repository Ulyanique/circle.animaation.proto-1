import { createSharedSceneConfig } from './shared-visuals.js';
import { createSceneTimeline } from './scene-timeline.js';

// Отдельная сцена с присланными изображениями и независимыми настройками.
export const PARTNERS_DEFAULTS = createSharedSceneConfig(createSceneTimeline(20));
PARTNERS_DEFAULTS.transition = {duration:.9};
PARTNERS_DEFAULTS.partners = {
  title: 'Янтарный циркуль', subtitle: 'Вечер ретроспектива',
  organizerLabel: 'ОРГАНИЗАТОР', coorganizerLabel: 'СООРГАНИЗАТОР', organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит',
  partnerLabel: 'СПОНСОРЫ', partner1: 'Промрукав', partner2: 'КЭАЗ',
  logoStyle: 'gold',
  organizer1Logo: '', organizer2Logo: '', partner1Logo: '', partner2Logo: '',
  frameVisible: true, curtainVisible: true, foliageVisible: true, compassVisible: true, motion: 1,
};
