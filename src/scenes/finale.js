import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// Финальная реплика: достаточно времени на поэтапный уход, цикл остаётся 18 с.
export const FINALE_DEFAULTS = createSharedSceneConfig(createSceneTimeline(18));

FINALE_DEFAULTS.caption.subtitleText = "История продолжается";
FINALE_DEFAULTS.timeline.holdDuration -= 2.7;
FINALE_DEFAULTS.timeline.fadeDuration = 5;
FINALE_DEFAULTS.finale = { retreatDepth: 2, retreatScale: 0.65 };
