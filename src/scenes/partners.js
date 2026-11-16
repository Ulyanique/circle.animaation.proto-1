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
  // Занавес задаётся по ширине PNG: 476 px — его исходный размер.
  curtainWidth: 476,
  frameVisible: true, curtainVisible: true, foliageVisible: true, compassVisible: true, motion: 1,
};

// ── Заставки отдельных спонсоров ──────────────────────────────────────────
// В общем ролике «Спонсоры» четыре знака стоят двумя ярусами — это список.
// Когда слово берёт один спонсор, ему нужен свой кадр: тот же фон и рамка,
// но знак крупно по центру. Заголовок, подзаголовок и разделитель повторяют
// вертикаль общего ролика, поэтому заставки стыкуются с ним без шва.
/** @param {"promrukav"|"keaz"} mark */
function sponsorCard(mark) {
  const defaults = createSharedSceneConfig(createSceneTimeline(16));
  defaults.transition = { duration: .9 };
  defaults.sponsor = {
    // Знак: встроенный (keaz | promrukav) или свой файл в markLogo.
    mark,
    markLogo: "",
    markScale: 1,
    title: 'Янтарный циркуль', subtitle: 'Вечер ретроспектива',
    logoStyle: 'gold',
    frameVisible: true, curtainVisible: true, curtainWidth: 476, motion: 1,
  };
  // Текст у заставки целиком в кадре (заголовок, подзаголовок, разделитель),
  // поэтому штатный DOM-титр выключен и ничего не дублирует.
  defaults.caption.titleVisible = false;
  return defaults;
}

/** Заставка Промрукава: знак вытянутый (3,6:1), поэтому он уже, но не мельче. */
export const SPONSOR_PROMRUKAV_DEFAULTS = sponsorCard('promrukav');
/** Заставка КЭАЗ: знак широкий (5,3:1), занимает всю ширину блока. */
export const SPONSOR_KEAZ_DEFAULTS = sponsorCard('keaz');
