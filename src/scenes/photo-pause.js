import { createSceneTimeline } from "./scene-timeline.js";

// Фотопауза использует общий 24-секундный жест и собственную рамку.
export const PHOTO_PAUSE_DEFAULTS = {
  timeline: createSceneTimeline(24),
  playback: { paused: false },
};
