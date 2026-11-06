import { createSceneTimeline } from "./scene-timeline.js";

// Финальная реплика: тот же вход и обратный уход в 18-секундном цикле.
export const FINALE_DEFAULTS = {
  timeline: createSceneTimeline(18),
  playback: { paused: false },
};
