// Покадровый план не зависит от скорости RAF и производительности браузера.
export const TRANSITION_SECONDS = 0.9;

/** @param {number} cycle @param {number} fps */
export function cycleFrames(cycle, fps) {
  if (!(Number.isFinite(cycle) && cycle > 0 && Number.isInteger(fps) && fps > 0))
    throw new Error("Некорректная длительность или частота кадров");
  return Math.max(1, Math.round(cycle * fps));
}

/** @param {{id:string,cycle:number}[]} entries @param {number} fps */
export function exportPlan(entries, fps) {
  let start = 0;
  const segments = entries.map(({ id, cycle }) => {
    const frames = cycleFrames(cycle, fps);
    const part = { id, frames, start };
    start += frames;
    return part;
  });
  return { segments, totalFrames: start, fps, transitionFrames: Math.round(TRANSITION_SECONDS * fps) };
}

/** Стоп-кадр старого вида полностью виден в первом кадре нового и исчезает за 0,9 с.
 * @param {number} frame @param {number} transitionFrames */
export function outgoingOpacity(frame, transitionFrames) {
  if (transitionFrames <= 0) return 0;
  const p = Math.min(1, Math.max(0, frame / transitionFrames));
  return 1 - p * p * (3 - 2 * p);
}
