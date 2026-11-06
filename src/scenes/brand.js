import { createSceneTimeline } from "./scene-timeline.js";

// 24 с: вход как у первой заставки, длительное удержание и обратный уход.
export const BRAND_DEFAULTS = {
  timeline: createSceneTimeline(24),
  playback: { paused: false },
};
