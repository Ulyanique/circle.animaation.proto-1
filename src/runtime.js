import { advanceTimeline } from "./playback.js";

/** @typedef {typeof import('./scenes/waiting.js').WAITING_DEFAULTS.timeline} Timeline */

/** Длительность полного цикла (без разовой стартовой задержки). */
/** @param {Timeline} timeline */
export function cycleDuration(timeline) {
  return timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration +
    timeline.fadeDuration + timeline.restDuration;
}

/**
 * Движок времени не зависит от Three.js, DOM и конкретной заставки.
 * Сцене достаточно иметь update(t, dt) и render(dt); seek не прогревает историю.
 */
export class AnimationRuntime {
  /** @param {{ update: (time: number, dt: number) => void, render: (dt: number) => void }} scene
   *  @param {{ timeline: Timeline, playback: { paused: boolean } }} config
   *  @param {number} [fps] */
  constructor(scene, config, fps = 60) {
    this.scene = scene;
    this.config = config;
    this.fps = fps;
    this.time = 0;
  }

  get cycle() { return cycleDuration(this.config.timeline); }

  /** @param {number} time @param {number} [dt] */
  renderAt(time, dt = 1 / this.fps) {
    this.time = time;
    this.scene.update(time, dt);
    this.scene.render(dt);
  }

  /** @param {number} elapsed @param {number} [dt] */
  advance(elapsed, dt = Math.min(0.05, elapsed)) {
    this.time = advanceTimeline(this.time, elapsed, this.config.timeline.speed, this.config.playback.paused);
    this.renderAt(this.time, dt);
  }
}
