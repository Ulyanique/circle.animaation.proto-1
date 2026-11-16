import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionDuration, transitionEase, outgoingOpacity, transitionLook } from '../src/scene-transition.js';
import { SCENES } from '../src/scenes/catalog.js';
import { configToJSON, parseConfigJSON, projectToJSON, parseProjectJSON, SCHEMA } from '../src/config.js';

test('переходы наследуют старое значение и хранятся независимо в проекте', () => {
  const scenes = SCENES.filter(s => s.defaults), ids = scenes.map(s => s.id);
  const configs = Object.fromEntries(scenes.map(s => [s.id, parseConfigJSON('{}', s.defaults)]));
  for (const cfg of Object.values(configs)) assert.equal(transitionDuration(cfg), .9);
  configs.brand.transition.duration = 1.5; configs['photo-pause'].transition.duration = 0;
  assert.equal(configs.waiting.transition.duration, .9);
  assert.equal(parseConfigJSON(configToJSON(configs.brand), scenes[1].defaults).transition.duration, 1.5);
  const restored = parseProjectJSON(projectToJSON(configs, ids), ids);
  assert.equal(restored.scenes['photo-pause'].transition.duration, 0);
  assert.ok(SCHEMA.some(section => section.id === 'transition'));
  assert.equal(transitionDuration({}), .9);
  assert.equal(transitionDuration({transition:{duration:NaN}}), .9);
  assert.equal(transitionDuration({transition:{duration:10}}), 5);
  assert.equal(transitionDuration({transition:{duration:-1}}), 0);
});

test('кривая CSS и прозрачность покадрового растворения ограничены и плавны', () => {
  assert.equal(transitionEase(0), 0); assert.equal(transitionEase(1), 1);
  assert.ok(Math.abs(transitionEase(.2) - .0816598) < .00001);
  assert.ok(Math.abs(transitionEase(.5) - .5) < .000001);
  let prev = 1;
  for (let frame = 0; frame <= 54; frame++) {
    const opacity = outgoingOpacity(frame, 60, .9);
    assert.ok(opacity <= prev && opacity >= 0 && opacity <= 1); prev = opacity;
  }
  assert.equal(outgoingOpacity(0, 60, .9), 1);
  assert.equal(outgoingOpacity(54, 60, .9), 0);
  assert.equal(outgoingOpacity(0, 60, 0), 0);
});

test('завеса не даёт двойной экспозиции двух видов', () => {
  // Решающее свойство: в каждой точке кадра виден ровно один вид. Достигается
  // тем, что граница завесы — единственное место, где виды встречаются, и она
  // мягкая, а не прозрачность всего кадра разом.
  for (let i = 0; i <= 100; i++) {
    const look = transitionLook(i / 100);
    assert.ok(look.outgoing === 0 || look.outgoing === 1,
      `на прогрессе ${i / 100} уходящий ${look.outgoing} — будет двойная экспозиция`);
  }
  assert.equal(transitionLook(0).outgoing, 1);
  assert.equal(transitionLook(1).outgoing, 0);
  // Граница с запасом выходит за кадр на краях: ни в первом, ни в последнем
  // кадре не остаётся полосы соседнего вида.
  // Граница с наклоном: учитываем и мягкость, и наклон, иначе на краевых
  // кадрах остаётся полоса соседнего вида.
  const l0 = transitionLook(0), l1 = transitionLook(1);
  assert.ok(l0.edge + l0.soft + l0.tilt / 2 <= 0, 'на старте граница должна быть левее кадра');
  assert.ok(l1.edge - l1.soft - l1.tilt / 2 >= 1, 'в конце граница должна быть правее кадра');
});

test('граница завесы идёт только вперёд и не откатывается', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 100; i++) {
    const edge = transitionLook(i / 100).edge;
    assert.ok(edge >= prev - 1e-9, `граница откатилась на ${i / 100}`);
    prev = edge;
  }
  // Мягкость постоянна: завеса не «дёргается» по ширине.
  const widths = new Set(Array.from({ length: 21 }, (_, i) => transitionLook(i / 20).soft));
  assert.equal(widths.size, 1, 'мягкость границы должна быть постоянной');
  // Наклон тоже постоянен — иначе граница «качается».
  const tilts = new Set(Array.from({ length: 21 }, (_, i) => transitionLook(i / 20).tilt));
  assert.equal(tilts.size, 1, 'наклон границы должен быть постоянным');
  assert.ok(transitionLook(.5).tilt > 0, 'граница должна быть наклонена, а не вертикальна');
});

test('свечение границы есть только в середине перехода', () => {
  // На краях перехода завесы быть не должно: иначе первый и последний кадр
  // вспыхивают золотой полосой на ровном месте.
  assert.ok(transitionLook(0).edgeGlow < .002);
  assert.ok(transitionLook(1).edgeGlow < .002);
  assert.ok(transitionLook(0).edgeCore < .002);
  assert.ok(transitionLook(1).edgeCore < .002);
  assert.ok(transitionLook(.5).edgeGlow > .2, `свечение ${transitionLook(.5).edgeGlow}`);
  assert.ok(transitionLook(.5).edgeCore > .15, `ядро ${transitionLook(.5).edgeCore}`);
  // Свечение симметрично по времени: подъём и спад одинаковы.
  assert.ok(Math.abs(transitionLook(.25).edgeGlow - transitionLook(.75).edgeGlow) < 1e-9);
});

test('наезд уходящего кадра монотонен и ограничен 2.5 %', () => {
  let prev = 0;
  for (let i = 0; i <= 100; i++) {
    const look = transitionLook(i / 100);
    assert.ok(look.zoom >= prev - 1e-9 && look.zoom <= 1.025, `наезд ${look.zoom}`);
    prev = look.zoom;
  }
  assert.equal(transitionLook(0).zoom, 1);
  assert.equal(transitionLook(1).zoom, 1.022);
  // Сдвиг только вверх, не больше 6 px: кадр не «прыгает».
  for (let i = 0; i <= 100; i++) {
    const drift = transitionLook(i / 100).drift;
    assert.ok(drift <= 0 && drift >= -6, `сдвиг ${drift}`);
  }
});

test('слои перехода ограничены и не дают отрицательных значений', () => {
  for (const bad of [-1, -0.001, NaN, Infinity, 2]) {
    const look = transitionLook(bad);
    for (const [key, value] of Object.entries(look)) {
      assert.ok(Number.isFinite(value), `${key} не число при ${bad}`);
      if (key === 'drift' || key === 'edge') continue;
      assert.ok(value >= 0, `${key} отрицателен при ${bad}`);
    }
  }
  assert.ok(Number.isFinite(transitionLook(Infinity).zoom));
});

test('экспорт не оставляет изменённое состояние контекста при ошибке наложения', async () => {
  const {drawOutgoingFrame} = await import('../src/scene-transition.js');
  const calls = [];
  // Мок ведёт себя как настоящий контекст: save/restore действительно
  // возвращают globalAlpha, иначе тест не поймал бы утечку состояния.
  const stack = [];
  const ctx = {
    globalAlpha: 1, fillStyle: '',
    save() { calls.push('save'); stack.push({a: this.globalAlpha, f: this.fillStyle}); },
    restore() { calls.push('restore'); const prev = stack.pop(); if (prev) { this.globalAlpha = prev.a; this.fillStyle = prev.f; } },
    fillRect() { calls.push('veil'); },
    beginPath() { calls.push('beginPath'); },
    moveTo() { calls.push('moveTo'); },
    lineTo() { calls.push('lineTo'); },
    closePath() { calls.push('closePath'); },
    clip() { calls.push('clip'); },
    createLinearGradient() { return {addColorStop() {}}; },
    drawImage() { calls.push('draw'); throw new Error('canvas error'); },
  };
  // Кадр 0: рисуется уходящий вид. Без рабочего полотна (мок его не даёт)
  // срабатывает жёсткая граница — уходящий кладётся в обрезку и падает.
  assert.throws(() => drawOutgoingFrame(ctx, {}, 0, 60, .9, 1920, 1080), /canvas error/);
  assert.deepEqual(calls, ['save', 'save', 'beginPath', 'moveTo', 'lineTo', 'lineTo', 'lineTo',
    'closePath', 'clip', 'draw', 'restore', 'restore']);
  assert.equal(ctx.globalAlpha, 1);
  calls.length = 0;
  assert.equal(drawOutgoingFrame(ctx, {}, 0, 60, 0, 1920, 1080), false);
  // Завершённый переход ничего не рисует и не трогает контекст.
  assert.equal(drawOutgoingFrame(ctx, {}, 60, 60, .9, 1920, 1080), false);
  assert.deepEqual(calls, []);
});
