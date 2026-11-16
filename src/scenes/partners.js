import { createSharedSceneConfig } from './shared-visuals.js';
import { createSceneTimeline } from './scene-timeline.js';

// Отдельная сцена с присланными изображениями и независимыми настройками.
// Цикл длиннее остальных роликов: в этой сцене читают четыре названия и две
// пары знаков, а не одну строку. На 20 секундах удержание было короче, чем
// нужно, чтобы прочитать состав спонсоров.
export const PARTNERS_DEFAULTS = createSharedSceneConfig(createSceneTimeline(26));
PARTNERS_DEFAULTS.transition = {duration:.9};
PARTNERS_DEFAULTS.partners = {
  title: 'Янтарный циркуль', subtitle: 'Вечер ретроспектива',
  organizerLabel: 'ОРГАНИЗАТОР', coorganizerLabel: 'СООРГАНИЗАТОР', organizer1: 'ПРОэлектро', organizer2: 'ПРОэлектрощит',
  partnerLabel: 'СПОНСОРЫ', partner1: 'Промрукав', partner2: 'КЭАЗ',
  logoStyle: 'gold',
  organizer1Logo: '', organizer2Logo: '', partner1Logo: '', partner2Logo: '',
  // Занавес теперь передний план: он перекрывает позолоту рамки, поэтому
  // держим его шире прежнего — иначе он читался как узкая тень сбоку.
  curtainWidth: 560,
  frameVisible: true, curtainVisible: true, foliageVisible: true, compassVisible: true, motion: 1,
};
