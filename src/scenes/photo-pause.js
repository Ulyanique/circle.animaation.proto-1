import { createSceneTimeline } from "./scene-timeline.js";
import { createSharedSceneConfig } from "./shared-visuals.js";

// Фотопауза использует общий 24-секундный жест и собственную рамку.
export const PHOTO_PAUSE_DEFAULTS = createSharedSceneConfig(createSceneTimeline(24));

// Логотип по центру; рамка и круговой текст настраиваются отдельно.
PHOTO_PAUSE_DEFAULTS.logo.scale = 0.47;
PHOTO_PAUSE_DEFAULTS.logo.offsetY = 0;
PHOTO_PAUSE_DEFAULTS.photo = {
  textEnabled: true, offsetX: 0, offsetY: 0, text: "ФОТОПАУЗА", repeats: 4, radius: 1.75, fontSize: 0.20,
  rotationSpeed: 0.035, textOpacity: 0.82, color: "#e8c77e",
  frameEnabled: true, frameMargin: 0.045, frameLength: 0.08, frameOpacity: 0.55,
};
