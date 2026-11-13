import test from 'node:test';
import assert from 'node:assert/strict';
import { beatDuration, nearestBeat, snapToBeat, beatInBar, holdToBars, beatMarkers, DEFAULT_BEAT_GRID } from '../src/beat-grid.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';
import { parseConfigJSON } from '../src/config.js';

test('сетка такта выключена по умолчанию и не меняет старые настройки', () => {
  for (const cfg of [WAITING_DEFAULTS, BRAND_DEFAULTS, FINALE_DEFAULTS]) {
    assert.equal(cfg.timeline.beatBpm, 0);
    assert.equal(cfg.timeline.beatOffset, 0);
    // Старый JSON без новых ключей получает нули, а не сюрприз.
    const old = parseConfigJSON('{"timeline":{"holdDuration":9}}', cfg);
    assert.equal(old.timeline.beatBpm, 0);
    assert.equal(old.timeline.beatOffset, 0);
    assert.equal(old.timeline.holdDuration, 9);
  }
  assert.equal(beatDuration(DEFAULT_BEAT_GRID), 0);
  assert.equal(snapToBeat(3.137, DEFAULT_BEAT_GRID), 3.137);
  assert.equal(holdToBars(WAITING_DEFAULTS.timeline, DEFAULT_BEAT_GRID), WAITING_DEFAULTS.timeline.holdDuration);
  assert.deepEqual(beatMarkers(4, DEFAULT_BEAT_GRID), []);
});

test('доли, такты и подгонка удержания под такт', () => {
  const grid = { bpm: 120, offset: 0, beatsPerBar: 4 };
  assert.equal(beatDuration(grid), 0.5);
  assert.equal(nearestBeat(3.2, grid), 6);
  assert.equal(snapToBeat(3.2, grid), 3);
  assert.equal(snapToBeat(3.3, grid), 3.5);
  // С фазой сетка сдвигается, но остаётся регулярной.
  assert.equal(snapToBeat(3.2, { ...grid, offset: 0.25 }), 3.25);
  assert.equal(beatInBar(0, grid), 1);
  assert.equal(beatInBar(2, grid), 1);       // 4 доли прошло — снова первая
  assert.equal(beatInBar(1.5, grid), 4);
  assert.deepEqual(beatMarkers(1.6, grid), [0, 0.5, 1, 1.5]);
  // Удержание 10,6 с при 120 BPM — это 2 такта ровно? Нет: 4 такта по 2 с.
  const hold = holdToBars({ holdDuration: 10.6 }, grid, 4);
  assert.equal(hold % 2, 0);
  assert.ok(Math.abs(hold - 10.6) <= 2);
  // Медленный BPM: такт 8 с, удержание 0,9 с — подгонка была бы растяжением в
  // восемь раз, поэтому значение остаётся прежним.
  assert.equal(holdToBars({ holdDuration: 0.9 }, { bpm: 30, beatsPerBar: 4 }, 4), 0.9);
  // Ближайший такт короче минимума — тоже без изменений.
  assert.equal(holdToBars({ holdDuration: 3 }, { bpm: 240, beatsPerBar: 4 }, 4), 3);
  // Некорректные значения BPM не ломают показ.
  for (const bpm of [NaN, -10, Infinity, 'быстро']) {
    assert.equal(beatDuration({ bpm }), 0);
    assert.equal(snapToBeat(2.2, { bpm }), 2.2);
  }
});

test('сетка не влияет на длительность цикла сама по себе', () => {
  const tl = WAITING_DEFAULTS.timeline;
  const cycle = (t) => t.drawDuration + t.emergeDuration + t.holdDuration + t.fadeDuration + t.restDuration;
  const before = cycle(tl);
  const saved = { ...tl };
  // Только включение сетки (без подгонки удержания) не меняет ни одного отрезка.
  tl.beatBpm = 128;
  assert.equal(cycle(tl), before);
  assert.deepEqual({ ...tl, beatBpm: saved.beatBpm }, saved);
});

test('сетка понимает и таймлайн сцены, и «чистые» ключи', () => {
  // В конфиге ключи с префиксом: beatBpm/beatOffset.
  const timeline = { beatBpm: 120, beatOffset: 0.25 };
  assert.equal(beatDuration(timeline), 0.5);
  assert.equal(snapToBeat(3.2, timeline), 3.25);
  assert.equal(beatInBar(1.75, timeline), 4);
  // Прежний вид ключей тоже работает.
  assert.equal(beatDuration({ bpm: 120, offset: 0.25 }), 0.5);
  assert.equal(snapToBeat(3.2, { bpm: 120, offset: 0.25 }), 3.25);
});
