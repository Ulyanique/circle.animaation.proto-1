import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_OPTIONS, DEFAULT_DELIVERY, deliveryOption, isDeliveryOption, deliveryBitrate,
  codecString, deliveryLabel, loadDelivery, saveDelivery, deliveryFilename, DELIVERY_STORAGE_KEY,
} from '../src/delivery.js';
import { codecBitDepth } from '../src/offline-video.js';

test('вариант доставки по умолчанию — совместимый H.264 в MP4', () => {
  assert.equal(DEFAULT_DELIVERY, 'h264');
  const option = deliveryOption();
  assert.equal(option.codec, 'avc');
  assert.equal(option.container, 'mp4');
  assert.equal(option.bitDepth, 8);
  // Неизвестное имя не должно ломать запись: получаем умолчание, а не undefined.
  assert.equal(deliveryOption('конечно-нет').id, 'h264');
  assert.equal(isDeliveryOption('h264'), true);
  assert.equal(isDeliveryOption('toString'), false);
});

test('10-битные варианты требуют десятибитную строку кодека', () => {
  // HEVC: автоматическая строка mediabunny — Main 8 бит, поэтому нужна своя.
  assert.equal(codecString(deliveryOption('hevc10')), 'hev1.2.4.L123.B0');
  assert.match(codecString(deliveryOption('hevc10')), /^hev1\.2\./);
  // VP9: глубина задаётся в строке кодека (10 вместо 08).
  assert.equal(codecString(deliveryOption('vp9_10')), 'vp09.02.10.10');
  // H.264 без своей строки: пусть собирает библиотека.
  assert.equal(codecString(deliveryOption('h264')), 'avc');
});

test('битрейт 10 бит ниже при том же визуальном качестве', () => {
  assert.equal(deliveryBitrate('h264', 40000000), 40000000);
  assert.equal(deliveryBitrate('hevc10', 40000000), 28000000);
  assert.equal(deliveryBitrate('vp9_10', 40000000), 28000000);
  assert.throws(() => deliveryBitrate('h264', 0), /Некорректный битрейт/);
  assert.throws(() => deliveryBitrate('h264', NaN), /Некорректный битрейт/);
});

test('подписи вариантов называют глубину явно', () => {
  assert.equal(deliveryLabel(deliveryOption('h264')), 'H.264 8 бит');
  assert.equal(deliveryLabel(deliveryOption('hevc10')), 'HEVC 10 бит');
  assert.equal(deliveryLabel(deliveryOption('vp9_10')), 'VP9 10 бит');
  for (const option of Object.values(DELIVERY_OPTIONS)) {
    assert.equal(typeof option.description, 'string');
    assert.ok(option.description.length > 20, `${option.id}: описание должно объяснять выбор`);
  }
});

test('имя файла различает 10 бит и контейнер', () => {
  assert.equal(deliveryFilename('intro', deliveryOption('h264'), 1920, 1080), 'intro-1920x1080.mp4');
  assert.equal(deliveryFilename('intro', deliveryOption('hevc10'), 3840, 2160), 'intro-3840x2160-10bit.mp4');
  assert.equal(deliveryFilename('intro', deliveryOption('vp9_10'), 1920, 1080), 'intro-1920x1080-10bit.webm');
});

test('выбор доставки запоминается и не портится мусором в хранилище', () => {
  const store = new Map();
  const fake = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(loadDelivery(fake), 'h264');
  assert.equal(saveDelivery('vp9_10', fake), true);
  assert.equal(store.get(DELIVERY_STORAGE_KEY), 'vp9_10');
  assert.equal(loadDelivery(fake), 'vp9_10');
  assert.equal(saveDelivery('ерунда', fake), false);
  assert.equal(loadDelivery(fake), 'vp9_10');
  store.set(DELIVERY_STORAGE_KEY, 'ерунда');
  assert.equal(loadDelivery(fake), 'h264');
  // Приватный режим: хранилище бросает — показ не должен падать.
  const broken = { getItem: () => { throw new Error('нет'); }, setItem: () => { throw new Error('нет'); } };
  assert.equal(loadDelivery(broken), 'h264');
  assert.equal(saveDelivery('hevc10', broken), true);
});

test('глубина читается из строки кодека, когда она там есть', () => {
  assert.equal(codecBitDepth('vp09.02.11.10.01.06.06.06.00'), 10);
  assert.equal(codecBitDepth('vp09.00.11.08.01.06.06.06.00'), 8);
  assert.equal(codecBitDepth('vp09.02.11.12'), 12);
  // У H.264 и HEVC глубина в строке не указана — не делаем вид, что знаем.
  assert.equal(codecBitDepth('avc1.640034'), null);
  assert.equal(codecBitDepth('hev1.2.4.L123.B0'), null);
  assert.equal(codecBitDepth(null), null);
  assert.equal(codecBitDepth(undefined), null);
  assert.equal(codecBitDepth(42), null);
});
