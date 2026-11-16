import test from 'node:test';
import assert from 'node:assert/strict';
import { sponsorCues, markBox, markGlintAt, markScaleFor } from '../src/sponsor-motion.js';
import { SPONSOR_KEAZ_DEFAULTS, SPONSOR_PROMRUKAV_DEFAULTS } from '../src/scenes/partners.js';
import { sceneById, RECORDING_CHAIN } from '../src/scenes/catalog.js';
import { cycleDuration } from '../src/runtime.js';

// Заставка спонсора: ритм, размер знака и место в программе. Проверки чистые —
// без браузера, чтобы они не зависели от скорости рендера.

const cuesAt = (local, timeline = SPONSOR_KEAZ_DEFAULTS.timeline) =>
  sponsorCues({ local, beforeStart: false, cycle: cycleDuration(timeline) }, timeline, 1);

test('заставки спонсоров заведены как отдельные виды с готовыми настройками', () => {
  for (const [id, defaults, mark] of [
    ['sponsor-promrukav', SPONSOR_PROMRUKAV_DEFAULTS, 'promrukav'],
    ['sponsor-keaz', SPONSOR_KEAZ_DEFAULTS, 'keaz'],
  ]) {
    assert.equal(sceneById(id).status, 'preview', `${id}: вид должен быть доступен`);
    assert.equal(sceneById(id).defaults, defaults);
    assert.equal(defaults.sponsor.mark, mark);
    // Заголовок и подзаголовок — те же, что в общем ролике спонсоров: заставки
    // должны стыковаться с ним без визуального шва.
    assert.equal(defaults.sponsor.title, 'Янтарный циркуль');
    assert.equal(defaults.sponsor.subtitle, 'Вечер ретроспектива');
    assert.equal(defaults.caption.titleVisible, false, `${id}: текст уже в кадре`);
    assert.ok(cycleDuration(defaults.timeline) >= 12, `${id}: на знак нужно время`);
    // В общий автопоказ заставки не входят: это адресные кадры под конкретное
    // выступление, а не часть непрерывной программы.
    assert.ok(!RECORDING_CHAIN.includes(id));
    assert.equal(defaults.transition.duration, .9);
  }
});

test('сцена заставки появляется из темноты и уходит в неё', () => {
  const tl = SPONSOR_KEAZ_DEFAULTS.timeline;
  assert.equal(cuesAt(0).visible, 0);
  assert.equal(cuesAt(cycleDuration(tl) - 1 / 60).visible, 0);
  assert.ok(cuesAt(6).visible > .95, 'на удержании кадр виден целиком');
  // Знак приходит последним: сначала заголовок и разделитель, потом логотип.
  assert.equal(cuesAt(.5).mark, 0);
  assert.ok(cuesAt(.5).title > 0, 'заголовок начинает появляться раньше знака');
  assert.ok(cuesAt(2.2).rule > 0, 'разделитель встаёт до знака');
  // Вход знака — 3,1…4,3 с при цикле 16 с: к четвёртой секунде он уже виден,
  // к пятой — полностью на месте.
  assert.ok(cuesAt(4).mark > .8, 'знак почти сел к четвёртой секунде');
  assert.equal(cuesAt(4.4).mark, 1, 'знак сел к 4,4 с');
});

test('знак встаёт полностью и не мигает на удержании', () => {
  const tl = SPONSOR_KEAZ_DEFAULTS.timeline;
  const entry = tl.drawDuration + tl.emergeDuration;
  for (let t = entry; t < entry + tl.holdDuration; t += .25) {
    assert.equal(cuesAt(t).mark, 1, `знак не досел к ${t} с`);
    assert.ok(cuesAt(t).visible > .99);
  }
  // Блик проходит уже по севшему знаку, а не во время подъёма.
  assert.ok(markGlintAt(SPONSOR_KEAZ_DEFAULTS) > entry * .62);
  assert.ok(cuesAt(markGlintAt(SPONSOR_KEAZ_DEFAULTS)).mark === 1);
});

test('размер знака считается от одного коэффициента: пропорции не меняются', () => {
  // Знак 5,3:1 (КЭАЗ) и 3,6:1 (Промрукав) — оба вписываются без сжатия по оси.
  for (const [w, h] of [[1590, 300], [749, 210], [400, 400]]) {
    for (const scale of [.5, 1, 1.8]) {
      const box = markBox(w, h, scale);
      assert.ok(box.width <= 900 * scale + 1e-6, 'ширина вышла за предел');
      assert.ok(box.height <= 300 * scale + 1e-6, 'высота вышла за предел');
      // Главное: соотношение сторон сохранено до последнего знака.
      assert.ok(Math.abs(box.width / box.height - w / h) < 1e-9, 'пропорции искажены');
      assert.ok(Math.abs(box.scale - box.width / w) < 1e-9);
    }
  }
  // Множитель из настроек ограничен разумными пределами.
  assert.equal(markScaleFor({ sponsor: { markScale: 99 } }), 1.8);
  assert.equal(markScaleFor({ sponsor: { markScale: .1 } }), .5);
  assert.equal(markScaleFor({}), 1);
  assert.equal(markScaleFor({ sponsor: { markScale: NaN } }), 1);
});

test('нулевое движение замораживает декор, но не гасит кадр', () => {
  const tl = SPONSOR_KEAZ_DEFAULTS.timeline;
  const still = sponsorCues({ local: 9, beforeStart: false }, tl, 0);
  assert.equal(still.idle, 0);
  assert.equal(still.visible, 1);
  assert.equal(still.mark, 1);
  // Один и тот же момент даёт одно и то же состояние: кадр детерминирован.
  assert.deepEqual(still, sponsorCues({ local: 9, beforeStart: false }, tl, 0));
});
