// Ход сцены соответствует реальному времени независимо от частоты кадров.
// Ограничение dt допустимо для постэффектов, но не для времени анимации.
/** @param {number} time @param {number} elapsed @param {number} speed @param {boolean} paused */
export function advanceTimeline(time, elapsed, speed, paused) {
  return paused ? time : time + Math.max(0, elapsed) * speed;
}
