import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// Финальная реплика: тот же вход и обратный уход в 18-секундном цикле.
export const FINALE_DEFAULTS = createSharedSceneConfig(createSceneTimeline(18));
