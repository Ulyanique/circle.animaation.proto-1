import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// Фотопауза использует общий 24-секундный жест и собственную рамку.
export const PHOTO_PAUSE_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));
