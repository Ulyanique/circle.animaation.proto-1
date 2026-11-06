import test from 'node:test';
import assert from 'node:assert/strict';
import { exteriorDistance } from '../src/outer-distance.js';

test('волна идёт наружу от объединённого силуэта и не появляется в отверстиях', () => {
  const w = 11, h = 11, alpha = new Uint8Array(w * h);
  for (let y = 3; y <= 7; y++) for (let x = 3; x <= 7; x++) alpha[y * w + x] = 1;
  alpha[5 * w + 5] = 0; // внутреннее отверстие знака
  const d = exteriorDistance(alpha, w, h);
  const at = (x, y) => d[y * w + x];
  assert.equal(at(5, 5), 0, 'внутренняя деталь не должна создавать волну');
  assert.equal(at(3, 3), 0);
  assert.equal(at(2, 5), 1);
  assert.equal(at(1, 5), 2);
  assert.ok(Math.abs(at(1, 1) - Math.sqrt(8)) < 1e-6);
});

test('внешние пустоты и отдельные фрагменты формы участвуют в общей волне', () => {
  const w = 9, h = 5, alpha = new Uint8Array(w * h);
  alpha[2 * w + 2] = 1;
  alpha[2 * w + 6] = 1;
  const d = exteriorDistance(alpha, w, h);
  assert.equal(d[2 * w + 4], 2);
  assert.equal(d[2 * w + 3], 1);
  assert.equal(d[2 * w + 5], 1);
});
