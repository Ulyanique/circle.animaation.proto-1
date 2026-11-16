import test from 'node:test';
import assert from 'node:assert/strict';
import { RECORDING_CHAIN } from '../src/scenes/catalog.js';
import {
  CHAIN_CANDIDATES, normalizeChain, loadRecordingChain, saveRecordingChain, chainBaseFilename,
} from '../src/recording-chain.js';
import {
  saveSceneSnapshot, loadSceneSnapshot, hasSceneSnapshot,
  diffFromDefaults, encodeConfigShareHash, decodeConfigShareHash,
} from '../src/scene-snapshots.js';
import { isProjectPayload } from '../src/ui.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PARTNERS_DEFAULTS } from '../src/scenes/partners.js';
import { mergeConfig, parseConfigJSON } from '../src/config.js';
import {
  defaultArchiveLayout, normalizeArchiveLayout, clampSlotDuration,
  swapArchiveItems, mapArchiveTime, archiveTotalDuration,
  loadArchiveSession, saveArchiveSession,
} from '../src/archive/session.js';
import { ARCHIVE_DURATION, FINALE_START } from '../src/archive/motion.js';

function createMemoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('recording-chain: сохраняет константу RECORDING_CHAIN неизменной и поддерживает опциональный блок спонсоров', () => {
  assert.deepEqual(RECORDING_CHAIN, ['waiting', 'brand', 'photo-pause', 'finale']);
  assert.deepEqual(CHAIN_CANDIDATES.map((c) => c.id), ['waiting', 'brand', 'partners', 'photo-pause', 'finale']);
  assert.deepEqual(normalizeChain(null), RECORDING_CHAIN);
  assert.deepEqual(normalizeChain([]), RECORDING_CHAIN);
  assert.deepEqual(normalizeChain(['finale', 'waiting', 'partners', 'waiting', 'unknown']), ['waiting', 'partners', 'finale']);
  assert.equal(chainBaseFilename(RECORDING_CHAIN), 'circle-01-02-08-09');
  assert.equal(chainBaseFilename(['waiting', 'brand', 'partners', 'photo-pause', 'finale']), 'circle-01-02-04-08-09');

  const store = createMemoryStore();
  assert.deepEqual(loadRecordingChain(store), RECORDING_CHAIN);
  saveRecordingChain(['waiting', 'partners', 'finale'], store);
  assert.deepEqual(loadRecordingChain(store), ['waiting', 'partners', 'finale']);
});

test('isProjectPayload: не путает одиночный конфиг со словом "scenes" в титрах с мультисценовым проектом', () => {
  const singleWithWord = structuredClone(BRAND_DEFAULTS);
  singleWithWord.caption.title = 'Behind the "scenes" 2026';
  assert.equal(isProjectPayload(singleWithWord), false);
  assert.equal(isProjectPayload({ version: 1, scenes: { brand: BRAND_DEFAULTS } }), true);
  assert.equal(isProjectPayload({ scenes: [] }), false);
  assert.equal(isProjectPayload(null), false);
});

test('partners config: поддерживает выбор шрифта, режим цвета логотипов и data:image загрузку', () => {
  assert.equal(PARTNERS_DEFAULTS.typography.font, 'cormorant-garamond');
  assert.equal(PARTNERS_DEFAULTS.partners.logoStyle, 'gold');
  assert.equal(PARTNERS_DEFAULTS.partners.partner1Logo, '');

  const customJson = JSON.stringify({
    typography: { font: 'unbounded' },
    partners: {
      logoStyle: 'original',
      partner1Logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      partner2Logo: 'javascript:alert(1)',
    },
  });
  const parsed = parseConfigJSON(customJson, PARTNERS_DEFAULTS);
  assert.equal(parsed.typography.font, 'unbounded');
  assert.equal(parsed.partners.logoStyle, 'original');
  assert.ok(parsed.partners.partner1Logo.startsWith('data:image/png;base64,'));
  assert.equal(parsed.partners.partner2Logo, '');
});

test('scene-snapshots: слоты A/B и компактная ссылка #cfg кодируют и восстанавливают только отличия', () => {
  const store = createMemoryStore();
  assert.equal(hasSceneSnapshot('brand', 'A', store), false);

  const modified = structuredClone(BRAND_DEFAULTS);
  modified.caption.title = 'Вариант А';
  modified.post.bloomStrength = 0.77;
  assert.equal(saveSceneSnapshot('brand', 'A', modified, store), true);
  assert.equal(hasSceneSnapshot('brand', 'A', store), true);
  assert.equal(loadSceneSnapshot('brand', 'A', store)?.caption?.title, 'Вариант А');

  const diff = diffFromDefaults(modified, BRAND_DEFAULTS);
  assert.deepEqual(diff, { caption: { title: 'Вариант А' }, post: { bloomStrength: 0.77 } });

  const hash = encodeConfigShareHash(modified, BRAND_DEFAULTS);
  assert.ok(hash.length > 0 && hash.length < 180);
  const decoded = decodeConfigShareHash(hash);
  const restored = mergeConfig(BRAND_DEFAULTS, decoded);
  assert.equal(restored.caption.title, 'Вариант А');
  assert.equal(restored.post.bloomStrength, 0.77);
  assert.equal(decodeConfigShareHash('!!!not-base64!!!'), null);
});

test('archive session: при стандартных 8 с каноническое время тождественно, а перестановка и длительности сохраняются', () => {
  const layout = defaultArchiveLayout();
  assert.equal(layout.length, 10);
  assert.equal(archiveTotalDuration(layout), ARCHIVE_DURATION);

  for (const sample of [0, 3.5, 8, 24.25, 79.9, FINALE_START, 85.4]) {
    const mapped = mapArchiveTime(layout, sample);
    assert.ok(Math.abs(mapped.canonicalTime - sample) < 1e-9, `t=${sample} -> ${mapped.canonicalTime}`);
  }

  layout[0].duration = clampSlotDuration(12);
  layout[1].duration = clampSlotDuration(4);
  // Сумма первых двух (12 + 4 = 16) равна 2 * 8 = 16, поэтому после второго слота времена снова совпадают.
  assert.equal(archiveTotalDuration(layout), ARCHIVE_DURATION);
  assert.ok(Math.abs(mapArchiveTime(layout, 6).canonicalTime - 4) < 1e-9);
  assert.ok(Math.abs(mapArchiveTime(layout, 12).canonicalTime - 8) < 1e-9);
  assert.ok(Math.abs(mapArchiveTime(layout, 16).canonicalTime - 16) < 1e-9);

  const swapped = swapArchiveItems(layout, 0, 1);
  assert.equal(swapped[0].duration, 4);
  assert.equal(swapped[1].duration, 12);

  const store = createMemoryStore();
  saveArchiveSession(swapped, store);
  const loaded = loadArchiveSession(store);
  assert.equal(loaded[0].duration, 4);
  assert.equal(loaded[1].duration, 12);
  assert.equal(normalizeArchiveLayout('corrupted').length, 10);
});
