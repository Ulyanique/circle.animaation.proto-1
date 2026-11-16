import { createSceneTimeline } from "./scene-timeline.js";
import { WAITING_DEFAULTS } from "./waiting.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// Финальная реплика: достаточно времени на поэтапный уход, цикл остаётся 18 с.
export const FINALE_DEFAULTS = createSharedSceneConfig(createSceneTimeline(18));

FINALE_DEFAULTS.typography.subtitleTracking = 0.18;
FINALE_DEFAULTS.logo.facetPolish = WAITING_DEFAULTS.logo.facetPolish;
FINALE_DEFAULTS.intro = { ...WAITING_DEFAULTS.intro };
FINALE_DEFAULTS.constructionGuides.enabled = true;
FINALE_DEFAULTS.caption.subtitleText = "История продолжается";
FINALE_DEFAULTS.timeline.holdDuration -= 2.7;
FINALE_DEFAULTS.timeline.fadeDuration = 5;
FINALE_DEFAULTS.finale = { retreatDepth: 2, retreatScale: 0.65,
  subtitleDrawDuration: 1.15, subtitleMoveDuration: 1.25, subtitleHoldDuration: 1, subtitleEraseDuration: 0.8 };
