import { WAITING_DEFAULTS } from "./waiting.js";

/** Те же вход и обратный уход, что у первой сцены; отличается только удержание. */
/** @param {number} cycle */
export function createSceneTimeline(cycle) {
  const { drawDuration, emergeDuration, fadeDuration, restDuration, ringsIntro, beatBpm, beatOffset } = WAITING_DEFAULTS.timeline;
  return {
    drawDuration,
    emergeDuration,
    holdDuration: cycle - drawDuration - emergeDuration - fadeDuration - restDuration,
    fadeDuration,
    restDuration,
    startDelay: 0,
    ringsIntro,
    speed: 1,
    beatBpm,
    beatOffset,
  };
}
