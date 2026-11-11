import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineCycle, timelineCursor, timelineRange, moveTimelineEdge, moveTimelineRange, timelineEdgeSeconds, timelineTimecode, timelineStepFrame, timelineCursorFrame, parseTimelineTimecode } from '../src/editor-timeline.js';

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


test('таймкод цикла считает кадры при целочисленной частоте, а не скорость воспроизведения', () => {
  assert.equal(timelineTimecode(0, 60), '00:00:00:00');
  assert.equal(timelineTimecode(1 / 60, 60), '00:00:00:01');
  assert.equal(timelineTimecode(59 / 60, 60), '00:00:00:59');
  assert.equal(timelineTimecode(60, 60), '00:01:00:00');
  assert.equal(timelineTimecode(3600 + 61 + 2 / 60, 60), '01:01:01:02');
  assert.equal(timelineTimecode(-1, 60), '00:00:00:00');
  assert.equal(timelineTimecode(NaN, 60), '00:00:00:00');
  assert.equal(timelineTimecode(1, 59.94), '—');
});


test('покадровая перемотка привязана к началу цикла и ограничена его границами', () => {
  const step = (t, direction) => timelineStepFrame(t, tl, 60, direction);
  assert.equal(step(2, -1), 2);
  assert.equal(step(2, 1), 2 + 1/60);
  assert.equal(step(2 + 1/60, 1), 2 + 2/60);
  assert.equal(step(2 + 1/60, -1), 2);
  assert.equal(step(2 + .02, -1), 2 + 1/60);
  assert.equal(step(2 + .02, 1), 2 + 2/60);
  assert.equal(step(21.999, 1), 2 + 1199/60);
  assert.equal(step(42 + 3/60, 1), 2 + 4/60);
  assert.equal(timelineStepFrame(2, tl, 0, 1), null);
  assert.equal(timelineStepFrame(2, {...tl, drawDuration: -15}, 60, 1), null);
  assert.equal(timelineStepFrame(2, {...tl, drawDuration: 5.001}, 60, 1), 2 + 1/60);
});


test('ввод таймкода проверяет формат, частоту и конец цикла', () => {
  const parse = value => parseTimelineTimecode(value, 60, 20);
  assert.equal(parse('00:00:10:01'), 10 + 1/60);
  assert.equal(parse(' 00:00:00:00 '), 0);
  assert.equal(parse('00:00:19:59'), 19 + 59/60);
  for (const value of ['00:00:20:00', '00:00:19:60', '00:60:00:00', '00:00:60:00', '0:00:01:00', '-1', '', 'NaN']) assert.equal(parse(value), null, value);
  assert.equal(parseTimelineTimecode('01:01:01:02', 60, 4000), 3661 + 2/60);
  assert.equal(parseTimelineTimecode('00:00:00:00', 59.94, 20), null);
});


test('сдвиг полосы сохраняет длину и ограничен границами цикла', () => {
  assert.deepEqual(moveTimelineRange(25,70,10), {start:35,end:80});
  assert.deepEqual(moveTimelineRange(25,70,-200), {start:0,end:45});
  assert.deepEqual(moveTimelineRange(25,70,200), {start:55,end:100});
  assert.deepEqual(moveTimelineRange(25,70,NaN), {start:25,end:70});
  assert.deepEqual(moveTimelineRange(0,100,5), {start:0,end:100});
  assert.deepEqual(moveTimelineRange(25,70,4.7), {start:30,end:75});
});


test('границы можно задать в секундах без округления до целого процента', () => {
  assert.deepEqual(timelineEdgeSeconds(25,90,'start',5.125,20), {start:25.625,end:90});
  assert.deepEqual(timelineEdgeSeconds(25,90,'end',20,20), {start:25,end:100});
  assert.equal(timelineEdgeSeconds(25,90,'start',18,20), null);
  assert.equal(timelineEdgeSeconds(25,90,'end',5,20), null);
  assert.equal(timelineEdgeSeconds(25,90,'end',21,20), null);
  assert.equal(timelineEdgeSeconds(25,90,'start',NaN,20), null);
  assert.equal(timelineEdgeSeconds(25,90,'start',1,0), null);
});


test('курсор привязывается к ближайшему кадру внутри локального цикла', () => {
  assert.equal(timelineCursorFrame(0,tl,60),0);
  assert.equal(timelineCursorFrame(2+10.024,tl,60),10+1/60);
  assert.equal(timelineCursorFrame(21.9999,tl,60),1199/60);
  assert.equal(timelineCursorFrame(22,tl,60),0);
  assert.equal(timelineCursorFrame(42+1/60,tl,60),1/60);
  assert.equal(timelineCursorFrame(2,tl,0),null);
});
