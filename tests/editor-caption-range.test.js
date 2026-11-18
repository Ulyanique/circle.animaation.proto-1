import test from 'node:test';
import assert from 'node:assert/strict';
import {captionMaskRange, scenarioCueRange} from '../src/editor-caption-range.js';
import {captionState, finaleCaptionState} from '../src/caption.js';
import {WAITING_DEFAULTS} from '../src/scenes/waiting.js';
import {BRAND_DEFAULTS} from '../src/scenes/brand.js';
import {PHOTO_PAUSE_DEFAULTS} from '../src/scenes/photo-pause.js';
import {FINALE_DEFAULTS} from '../src/scenes/finale.js';

for (const [scene, defaults, ids] of [
  ['waiting', WAITING_DEFAULTS, ['title','subtitle','date']],
  ['brand', BRAND_DEFAULTS, ['title']], ['finale', FINALE_DEFAULTS, ['title','subtitle']],
]) test(`${scene}: границы масок соответствуют реальной модели титров`, () => {
  for (const variant of [0,1,2]) {
    const cfg = structuredClone(defaults), tl = cfg.timeline;
    if (variant === 1) { tl.holdDuration += 3; tl.fadeDuration += .7; }
    if (variant === 2) { tl.holdDuration = .2; }
    for (const id of ids) {
      const range = captionMaskRange(scene, id, cfg);
      assert.ok(range);
      const on = scene === 'brand' ? undefined : tl.drawDuration + tl.emergeDuration + Math.max(.05,cfg.intro.cornerDuration) + Math.max(.05,cfg.intro.liftDuration) - Math.max(0,cfg.intro.titleDelay);
      const stateAt = local => scene === 'finale' ? finaleCaptionState(tl.startDelay + local, tl, on, cfg.finale) : captionState(tl.startDelay + local, tl, on, scene === 'waiting' ? .42 : 1);
      // Проверка на плотной сетке и с обеих сторон границ, включая короткое удержание.
      const times = Array.from({length:Math.ceil(range.cycle * 120)}, (_,i) => i / 120);
      if (range.end > range.start) times.push(range.start - .0001, range.start + .0001, range.end - .0001, range.end + .0001);
      for (const t of times.filter(t => t >= 0 && t < range.cycle)) {
        const value = stateAt(t).lines[id].outline;
        assert.equal(value > 1e-12, t > range.start && t < range.end, `${scene} ${id} вариант ${variant}: t=${t} маска=${value} ${JSON.stringify(range)}`);
      }
    }
  }
});
test('фотопауза и неизвестные строки не получают выдуманные интервалы', () => {
  assert.equal(captionMaskRange('photo-pause', 'title', PHOTO_PAUSE_DEFAULTS), null);
  assert.equal(captionMaskRange('waiting', 'logo', WAITING_DEFAULTS), null);
});

test('нулевая пауза допустима и не скрывает диапазон маски', () => {
  const cfg=structuredClone(WAITING_DEFAULTS); cfg.timeline.restDuration=0;
  assert.ok(captionMaskRange('waiting','title',cfg).end > 0);
});

test('сценарные полосы активности возвращают достоверные интервалы встроенных слоёв', () => {
  const logoWait = scenarioCueRange('waiting', 'logo', WAITING_DEFAULTS);
  assert.ok(logoWait && logoWait.start === 0 && logoWait.end > logoWait.start && logoWait.end <= logoWait.cycle);

  const ringWait = scenarioCueRange('waiting', 'ringLeft', WAITING_DEFAULTS);
  assert.ok(ringWait && ringWait.start > 0 && ringWait.end > ringWait.start);
  const ringBrand = scenarioCueRange('brand', 'ringLeft', BRAND_DEFAULTS);
  assert.ok(ringBrand && ringBrand.start === 0 && ringBrand.end > ringBrand.start);

  const topPhoto = scenarioCueRange('photo-pause', 'topIllumination', PHOTO_PAUSE_DEFAULTS);
  const labelPhoto = scenarioCueRange('photo-pause', 'photoLabel', PHOTO_PAUSE_DEFAULTS);
  const aperturePhoto = scenarioCueRange('photo-pause', 'photoAperture', PHOTO_PAUSE_DEFAULTS);
  assert.ok(topPhoto && topPhoto.start > 0 && topPhoto.end > topPhoto.start);
  assert.ok(labelPhoto && labelPhoto.start > 0 && labelPhoto.end > labelPhoto.start);
  assert.ok(aperturePhoto && aperturePhoto.start > 0 && aperturePhoto.end > aperturePhoto.start);

  assert.equal(scenarioCueRange('partners', 'logo', WAITING_DEFAULTS), null);
  assert.equal(scenarioCueRange('waiting', 'unknownLayer', WAITING_DEFAULTS), null);
});
