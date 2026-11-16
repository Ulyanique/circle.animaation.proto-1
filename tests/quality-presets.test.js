import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_PRESETS, qualityPostOverrides, applyQualityPreset, suggestedQuality, parallaxAmount, isQualityPreset } from '../src/quality-presets.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';

test('пресеты качества меняют только стоимость кадра', () => {
  const post = WAITING_DEFAULTS.post;
  const draft = applyQualityPreset(post, 'draft');
  const master = applyQualityPreset(post, 'master');
  // Черновик дешевле: без MSAA, с ослабленным блумом, но с дизерингом —
  // иначе полосы на тёмном градиенте видны даже в монтаже.
  assert.equal(draft.msaaSamples, 0);
  assert.ok(draft.bloomIntensity < post.bloomIntensity);
  assert.ok(draft.dither > 0);
  assert.ok(draft.smaa);
  // Мастер возвращает полный кадр.
  assert.equal(master.msaaSamples, post.msaaSamples);
  assert.equal(master.bloomIntensity, post.bloomIntensity);
  assert.equal(master.dither, post.dither);
  // Исходные настройки сцены не мутируются.
  assert.equal(post.msaaSamples, WAITING_DEFAULTS.post.msaaSamples);
  // Композиция и материал пресет не трогает.
  assert.deepEqual(Object.keys(draft).sort(), Object.keys(post).sort());
  // Неизвестный пресет не ломает кадр: берётся превью.
  assert.equal(applyQualityPreset(post, 'nope').msaaSamples, post.msaaSamples);
  assert.equal(isQualityPreset('master'), true);
  assert.equal(isQualityPreset('nope'), false);
  assert.equal(suggestedQuality('2160p'), 'preview');
  for (const p of Object.values(QUALITY_PRESETS)) assert.ok(qualityPostOverrides(p.id).id === p.id);
});

test('пресет качества запоминается и не ломает показ испорченным значением', async () => {
  const { loadQuality, saveQuality, QUALITY_STORAGE_KEY } = await import('../src/quality-presets.js');
  const store = new Map();
  const fake = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  assert.equal(loadQuality(fake), 'preview');
  saveQuality('draft', fake);
  assert.equal(fake.getItem(QUALITY_STORAGE_KEY), 'draft');
  assert.equal(loadQuality(fake), 'draft');
  fake.setItem(QUALITY_STORAGE_KEY, 'ультра');
  assert.equal(loadQuality(fake), 'preview');
  assert.equal(saveQuality('unknown', fake), false);
  // Приватный режим: хранилище бросает — показ продолжается на превью.
  const broken = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  assert.equal(loadQuality(broken), 'preview');
  assert.doesNotThrow(() => saveQuality('master', broken));
});


test('параллакс масштабируется с мастер-разрешением и выключается нулём', () => {
  assert.equal(parallaxAmount(0, { width: 3840 }), 0);
  assert.equal(parallaxAmount(1, { width: 1920 }), 1);
  assert.equal(parallaxAmount(1, { width: 3840 }), 2);
  // Неизвестное разрешение не должно обнулять эффект.
  assert.equal(parallaxAmount(1.5, undefined), 1.5);
  assert.equal(parallaxAmount(NaN, { width: 1920 }), 0);
});
