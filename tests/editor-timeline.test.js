import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineCycle, timelineCursor, timelineRange, moveTimelineEdge } from '../src/editor-timeline.js';

const tl = {startDelay: 2, drawDuration: 5, emergeDuration: 5, holdDuration: 5, fadeDuration: 3, restDuration: 2};

test('шкала показывает локальное время цикла без стартовой задержки и повторяется на шве', () => {
  assert.equal(timelineCycle(tl), 20);
  assert.equal(timelineCursor(0, tl), 0);
  assert.equal(timelineCursor(2, tl), 0);
  assert.equal(timelineCursor(7, tl), 25);
  assert.equal(timelineCursor(12, tl), 50);
  assert.equal(timelineCursor(22, tl), 0);
  assert.equal(timelineCursor(32, tl), 50);
  assert.equal(timelineCursor(NaN, tl), 0);
  assert.equal(timelineCursor(10, {...tl, drawDuration: -15}), 0);
});

test('границы интервала ограничены и не могут пересечься', () => {
  assert.deepEqual(timelineRange(undefined, undefined), {start: 25, end: 90});
  assert.deepEqual(timelineRange(99, 1), {start: 99, end: 100});
  assert.deepEqual(timelineRange(-100, 999), {start: 0, end: 100});
  assert.deepEqual(moveTimelineEdge(25, 90, 'start', 40.3), {start: 40, end: 90});
  assert.deepEqual(moveTimelineEdge(25, 90, 'start', 200), {start: 89, end: 90});
  assert.deepEqual(moveTimelineEdge(25, 90, 'end', -10), {start: 25, end: 26});
  assert.deepEqual(moveTimelineEdge(25, 90, 'end', 101), {start: 25, end: 100});
  assert.deepEqual(moveTimelineEdge(25, 90, 'start', NaN), {start: 25, end: 90});
});

test('метки фаз сохраняют длительность цикла и противоположную фазу', async () => {
  const { movePhaseBoundary } = await import('../src/editor-timeline.js');
  const entry = movePhaseBoundary(tl, 'entry', 8, 1);
  assert.deepEqual(entry, {drawDuration: 4, emergeDuration: 4, holdDuration: 7, fadeDuration: 3, restDuration: 2});
  assert.equal(timelineCycle(entry), 20);
  const exit = movePhaseBoundary(tl, 'exit', 17, 1);
  assert.deepEqual(exit, {drawDuration: 5, emergeDuration: 5, holdDuration: 7, fadeDuration: 1.8, restDuration: 1.2});
  assert.equal(timelineCycle(exit), 20);
  assert.equal(movePhaseBoundary(tl, 'entry', 100, 1).holdDuration, 1);
  assert.equal(movePhaseBoundary(tl, 'exit', -100, 4).holdDuration, 4);
  assert.equal(movePhaseBoundary(tl, 'entry', NaN, 1), null);
});
