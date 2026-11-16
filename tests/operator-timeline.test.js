import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timelinePhases, timelineCursorPct, phaseTimeLabel, phaseTicks,
} from '../src/operator-timeline.js';

// Полоса фаз в пульте должна совпадать с тем, что реально играет сцена:
// границы берутся из конфига таймлайна, а не задаются на глаз.

const TL = { drawDuration: 2, emergeDuration: 3, holdDuration: 5, fadeDuration: 2, restDuration: 2 };

test('три фазы покрывают цикл без щелей и наложений', () => {
  const phases = timelinePhases(TL);
  assert.equal(phases.length, 3);
  assert.deepEqual(phases.map(p => p.key), ['entry', 'hold', 'exit']);
  // Стык фаз совпадает точно: иначе на полосе был бы разрыв.
  assert.equal(phases[0].end, phases[1].start);
  assert.equal(phases[1].end, phases[2].start);
  // Начало первой — ноль, конец последней — весь цикл.
  assert.equal(phases[0].start, 0);
  assert.equal(phases[2].end, 14);
  // Ширины в процентах дают ровно 100.
  const total = phases.reduce((sum, p) => sum + p.widthPct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `ширины ${total}`);
});

test('вход включает прорисовку и появление, выход — уход и паузу', () => {
  const [entry, hold, exit] = timelinePhases(TL);
  assert.equal(entry.seconds, TL.drawDuration + TL.emergeDuration);
  assert.equal(hold.seconds, TL.holdDuration);
  assert.equal(exit.seconds, TL.fadeDuration + TL.restDuration);
  // Внутренние стадии нужны для засечек: видно, где кончается прорисовка.
  assert.deepEqual(entry.inside, [2, 3]);
  assert.deepEqual(exit.inside, [2, 2]);
});

test('курсор считается по той же сумме, что и полоса', () => {
  assert.equal(timelineCursorPct(0, TL), 0);
  assert.equal(timelineCursorPct(14, TL), 100);
  assert.equal(timelineCursorPct(7, TL), 50);
  // Выход за границы зажимается: курсор не уезжает за полосу.
  assert.equal(timelineCursorPct(-5, TL), 0);
  assert.equal(timelineCursorPct(99, TL), 100);
  assert.equal(timelineCursorPct(NaN, TL), 0);
  // Точка на стыке входа и удержания — ровно конец первой фазы.
  const entry = timelinePhases(TL)[0];
  assert.ok(Math.abs(timelineCursorPct(entry.end, TL) - entry.endPct) < 1e-9);
});

test('вырожденный таймлайн не роняет полосу', () => {
  // Нули и отрицательные значения: полосы нет, а не деление на ноль.
  for (const tl of [null, undefined, {}, { drawDuration: 0, emergeDuration: 0, holdDuration: 0, fadeDuration: 0, restDuration: 0 },
    { drawDuration: -5, emergeDuration: -1, holdDuration: -2 }]) {
    assert.deepEqual(timelinePhases(tl), []);
    assert.equal(timelineCursorPct(3, tl), 0);
  }
  // Одна фаза нулевой длины не должна давать NaN в процентах.
  const withEmpty = timelinePhases({ drawDuration: 0, emergeDuration: 4, holdDuration: 0, fadeDuration: 6 });
  for (const phase of withEmpty) {
    assert.ok(Number.isFinite(phase.startPct) && Number.isFinite(phase.widthPct));
    assert.ok(phase.widthPct >= 0);
  }
});

test('метки времени читаются одинаково: всегда один знак после запятой', () => {
  // «17 с» рядом с «5.0 с» читалось как опечатка — теперь разрядка одна.
  assert.equal(phaseTimeLabel(17), '17.0 с');
  assert.equal(phaseTimeLabel(5), '5.0 с');
  assert.equal(phaseTimeLabel(0), '0.0 с');
  assert.equal(phaseTimeLabel(0.04), '0.0 с');
  assert.equal(phaseTimeLabel(-3), '0.0 с');
  assert.equal(phaseTimeLabel(NaN), '0.0 с');
  assert.equal(phaseTimeLabel(12.34), '12.3 с');
});

test('засечки стадий идут строго внутри своей фазы', () => {
  for (const phase of timelinePhases(TL)) {
    const ticks = phaseTicks(phase);
    for (const tick of ticks) {
      assert.ok(tick > phase.start - 1e-9, `засечка ${tick} до начала ${phase.start}`);
      assert.ok(tick <= phase.end + 1e-9, `засечка ${tick} после конца ${phase.end}`);
    }
    // Последняя засечка совпадает с концом фазы: стадии исчерпывают фазу.
    if (ticks.length) assert.ok(Math.abs(ticks[ticks.length - 1] - phase.end) < 1e-9);
  }
});

test('полоса и курсор не зависят от того, где стоит стартовая задержка', () => {
  // startDelay сдвигает показ целиком, но фазы цикла от него не меняются:
  // иначе полоса поехала бы относительно курсора.
  const withDelay = { ...TL, startDelay: 4.5 };
  const a = timelinePhases(TL), b = timelinePhases(withDelay);
  assert.deepEqual(a, b);
  assert.equal(timelineCursorPct(3, TL), timelineCursorPct(3, withDelay));
});
