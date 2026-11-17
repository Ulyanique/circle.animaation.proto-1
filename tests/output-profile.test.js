import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER_PRESETS, DEFAULT_MASTER, masterSize, masterScale, masterId,
  setMasterPreset, loadMasterPreset, resetMasterPreset, MASTER_STORAGE_KEY,
} from '../src/output-profile.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

test('base master stays 1920×1080 at the project frame rate', () => {
  resetMasterPreset();
  assert.equal(masterId(), DEFAULT_MASTER);
  assert.deepEqual(masterSize(), { width: 1920, height: 1080, fps: 30 });
  assert.equal(masterScale(), 1);
  assert.deepEqual(Object.keys(MASTER_PRESETS).sort(), ['1080p', '2160p']);
});

test('4K master changes only the pixel grid, not the frame rate', () => {
  resetMasterPreset();
  assert.equal(setMasterPreset('2160p'), true);
  assert.deepEqual(masterSize(), { width: 3840, height: 2160, fps: 30 });
  assert.equal(masterScale(), 2);
  assert.equal(masterId(), '2160p');
});

test('unknown presets are rejected without changing the active profile', () => {
  resetMasterPreset();
  for (const id of ['8k', '', null, undefined, 42, 'toString'])
    assert.equal(setMasterPreset(id), false);
  assert.equal(masterId(), DEFAULT_MASTER);
});

test('the chosen master is remembered and restored, damaged values fall back', () => {
  const storage = fakeStorage();
  globalThis.localStorage = storage;
  try {
    resetMasterPreset();
    setMasterPreset('2160p');
    assert.equal(storage.dump()[MASTER_STORAGE_KEY], '2160p');
    resetMasterPreset();
    assert.equal(loadMasterPreset(), '2160p');
    assert.equal(masterSize().width, 3840);
    storage.setItem(MASTER_STORAGE_KEY, 'broken');
    resetMasterPreset();
    assert.equal(loadMasterPreset(), DEFAULT_MASTER);
    assert.equal(masterSize().width, 1920);
  } finally {
    delete globalThis.localStorage;
    resetMasterPreset();
  }
});

test('storage failures do not break switching', () => {
  globalThis.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
  };
  try {
    resetMasterPreset();
    assert.equal(setMasterPreset('2160p'), true);
    assert.equal(masterSize().width, 3840);
    assert.equal(loadMasterPreset(), '2160p');
  } finally {
    delete globalThis.localStorage;
    resetMasterPreset();
  }
});
