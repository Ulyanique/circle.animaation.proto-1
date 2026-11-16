import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shutterSamples, photoShutterSamples, shutterTimes, SHUTTER_THRESHOLD_DEG } from '../src/photo-shutter.js';

const photoConfig = overrides => ({
  photo: { textEnabled: true, rotationSpeed: 0.035, ...overrides },
});

test('на обычной скорости 60 fps затвор не включается', () => {
  // 0,035 об/с при 60 fps — 0,21° за кадр: меньше пикселя, размазывать нечего.
  const perFrame = 0.035 * 360 / 60;
  assert.ok(perFrame < SHUTTER_THRESHOLD_DEG);
  assert.equal(shutterSamples(perFrame), 1);
  assert.equal(photoShutterSamples(photoConfig(), { id: 'photo-pause', fps: 60 }), 1);
});

test('на медленном обороте и высоком fps выборок больше', () => {
  const slow = 0.035 * 360 / 15; // медленное воспроизведение — 0,84° за кадр
  assert.equal(shutterSamples(slow), 3);
  assert.equal(photoShutterSamples(photoConfig(), { id: 'photo-pause', fps: 15 }), 3);
  // Верхняя граница: 9 выборок, дальше выигрыш не оправдывает рендер.
  assert.equal(shutterSamples(90), 9);
  assert.equal(shutterSamples(1000), 9);
});

test('затвор выключен там, где вращения нет', () => {
  assert.equal(photoShutterSamples(photoConfig(), { id: 'waiting', fps: 15 }), 1);
  assert.equal(photoShutterSamples(photoConfig({ textEnabled: false }), { id: 'photo-pause', fps: 15 }), 1);
  assert.equal(photoShutterSamples(photoConfig({ rotationSpeed: 0 }), { id: 'photo-pause', fps: 15 }), 1);
  // Испорченное значение не должно ломать кадр.
  assert.equal(photoShutterSamples(photoConfig({ rotationSpeed: NaN }), { id: 'photo-pause', fps: 15 }), 1);
  assert.equal(photoShutterSamples({}, { id: 'photo-pause' }), 1);
  // Нулевая скорость воспроизведения не превращается в деление на ноль.
  assert.ok(photoShutterSamples(photoConfig(), { id: 'photo-pause', fps: 60, speed: 0 }) >= 1);
});

test('выборки лежат внутри кадра и детерминированы', () => {
  const times = shutterTimes(10, 1 / 60, 4);
  assert.equal(times.length, 4);
  // Затвор 180° даёт окно в половину кадра — оно не выходит за сам кадр.
  for (const time of times) assert.ok(time > 10 - 1 / 60 && time < 10 + 1 / 60, `выборка вне кадра: ${time}`);
  // Окно симметрично вокруг момента кадра (затвор 180° = половина кадра):
  // средняя выборка равна самому кадру, иначе появлялся бы сдвиг фазы.
  const span = (1 / 60) * 0.5;
  assert.ok(Math.abs(times[0] - (10 - span * 0.375)) < 1e-12);
  // Средняя выборка — ровно момент кадра: усреднение не сдвигает фазу.
  assert.ok(Math.abs(times.reduce((a, b) => a + b, 0) / times.length - 10) < 1e-12);
  assert.ok(times[0] < 10 && times.at(-1) > 10);
  const again = shutterTimes(10, 1 / 60, 4);
  assert.deepEqual(again, times, 'время кадра должно давать те же выборки');
  // Одна выборка — ровно момент кадра, без сдвига.
  assert.deepEqual(shutterTimes(10, 1 / 60, 1), [10]);
});
