/**
 * Раскладка фаз цикла для полосы таймлайна в пульте.
 *
 * Раньше таймлайн был одной перемоткой: по нему нельзя было понять, где
 * кончается вход, сколько длится удержание и когда начинается уход. Фазы живут
 * в конфиге (drawDuration/emergeDuration/holdDuration/fadeDuration/
 * restDuration), поэтому полоса строится из них, а не из догадок.
 *
 * Чистая функция: те же числа при тех же настройках, поэтому подписи и курсор
 * не могут разойтись с тем, что реально играет сцена.
 */

/** @typedef {{drawDuration:number, emergeDuration:number, holdDuration:number, fadeDuration:number, restDuration:number}} Timeline */

/**
 * Фазы цикла в секундах и в процентах ширины полосы.
 * Вход включает прорисовку и появление из тени; выход — уход в тень и паузу.
 * @param {Timeline} tl
 * @returns {{key:string, label:string, short:string, start:number, end:number,
 *   startPct:number, endPct:number, widthPct:number, seconds:number}[]}
 */
export function timelinePhases(tl) {
  const part = (value) => (Number.isFinite(value) && value > 0 ? value : 0);
  const draw = part(tl?.drawDuration);
  const emerge = part(tl?.emergeDuration);
  const hold = part(tl?.holdDuration);
  const fade = part(tl?.fadeDuration);
  const rest = part(tl?.restDuration);
  const cycle = draw + emerge + hold + fade + rest;
  if (cycle <= 0) return [];
  const raw = [
    { key: 'entry', label: 'Вход', short: 'вход', seconds: draw + emerge, inside: [draw, emerge] },
    { key: 'hold', label: 'Удержание', short: 'удержание', seconds: hold, inside: [hold] },
    { key: 'exit', label: 'Выход', short: 'выход', seconds: fade + rest, inside: [fade, rest] },
  ];
  let at = 0;
  return raw.map((phase) => {
    const start = at;
    const end = at + phase.seconds;
    at = end;
    return {
      key: phase.key,
      label: phase.label,
      short: phase.short,
      start,
      end,
      startPct: start / cycle * 100,
      endPct: end / cycle * 100,
      widthPct: phase.seconds / cycle * 100,
      seconds: phase.seconds,
      // Внутренние стадии нужны, чтобы показать, из чего состоит вход и выход.
      inside: phase.inside.filter((value) => value > 0),
    };
  });
}

/**
 * Положение курсора в процентах ширины полосы. Курсор считается от той же
 * суммы фаз, что и полоса, поэтому не съезжает при смене длительности.
 * @param {number} localSeconds @param {Timeline} tl
 */
export function timelineCursorPct(localSeconds, tl) {
  const phases = timelinePhases(tl);
  if (!phases.length) return 0;
  const cycle = phases[phases.length - 1].end;
  if (!Number.isFinite(localSeconds)) return 0;
  const local = Math.min(Math.max(0, localSeconds), cycle);
  return local / cycle * 100;
}

/**
 * Подписи меток: имя фазы и время её начала. Время пишется коротко — до одной
 * десятой, потому что на пульте важен ритм, а не кадровая точность.
 * @param {number} seconds
 */
export function phaseTimeLabel(seconds) {
  const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  // Один знак после запятой всегда: «17.0 с» рядом с «5.0 с» читается как
  // сетка, а «17 с» рядом с «5.0 с» — как опечатка.
  return `${value.toFixed(1)} с`;
}

/**
 * Границы, по которым в фазе ставится засечка: каждая внутренняя стадия.
 * Нужна, чтобы внутри «входа» было видно, где кончается прорисовка и
 * начинается появление из тени.
 * @param {{start:number, inside:number[]}} phase
 */
export function phaseTicks(phase) {
  const ticks = [];
  let at = phase.start;
  for (const value of phase.inside) {
    at += value;
    ticks.push(at);
  }
  return ticks;
}
