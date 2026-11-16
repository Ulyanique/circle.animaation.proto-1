import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSceneConfig, saveSceneConfig } from '../src/config.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';

test('storage failures are reported, successful saves are acknowledged', () => {
  const original = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
    let failed;
    const warn = console.warn; console.warn = () => {};
    try { loadSceneConfig('waiting', WAITING_DEFAULTS, id => { failed = id; }); } finally { console.warn = warn; }
    assert.equal(failed, 'waiting');
    assert.equal(saveSceneConfig('waiting', WAITING_DEFAULTS), false);
    globalThis.localStorage = { setItem() {} };
    assert.equal(saveSceneConfig('waiting', WAITING_DEFAULTS), true);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

// Переполнение квоты — не то же самое, что запрет хранилища: в первом случае
// пользователь может освободить место (убрать логотип), во втором — только
// скачать бэкап. Общее «не сохранилось» не даёт этого понять.
test('quota overflow is distinguished from blocked storage', async () => {
  const { saveSceneConfigDetailed } = await import('../src/config.js');
  const original = globalThis.localStorage;
  const quota = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; return e; };
  const blocked = () => { const e = new Error('blocked'); e.name = 'SecurityError'; return e; };
  try {
    globalThis.localStorage = { setItem() { throw quota(); } };
    assert.deepEqual(saveSceneConfigDetailed('waiting', WAITING_DEFAULTS), { ok: false, reason: 'quota' });

    globalThis.localStorage = { setItem() { throw blocked(); } };
    assert.deepEqual(saveSceneConfigDetailed('waiting', WAITING_DEFAULTS), { ok: false, reason: 'blocked' });

    globalThis.localStorage = { setItem() { throw new Error('иная'); } };
    assert.deepEqual(saveSceneConfigDetailed('waiting', WAITING_DEFAULTS), { ok: false, reason: 'unknown' });

    globalThis.localStorage = { setItem() {} };
    assert.deepEqual(saveSceneConfigDetailed('waiting', WAITING_DEFAULTS), { ok: true, reason: null });

    // Короткая форма остаётся булевой — её используют и другие места.
    globalThis.localStorage = { setItem() { throw quota(); } };
    assert.equal(saveSceneConfig('waiting', WAITING_DEFAULTS), false);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

// Настоящий localStorage тоже переполняется: 4 логотипа по 1.5 МБ — это уже
// больше типичной квоты в 5 МБ, и сохранение обязано честно сообщить об этом.
test('a config with heavy logos exceeds a browser-sized quota', () => {
  const LIMIT = 5 * 1024 * 1024;
  const original = globalThis.localStorage;
  const store = new Map();
  let used = 0;
  try {
    globalThis.localStorage = {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) {
        const prev = store.has(key) ? store.get(key).length : 0;
        if (used - prev + value.length > LIMIT) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        used += value.length - prev; store.set(key, value);
      },
      removeItem(key) { if (store.has(key)) { used -= store.get(key).length; store.delete(key); } },
    };
    const logo = 'data:image/png;base64,' + 'A'.repeat(1_600_000);
    const heavy = () => ({ ...JSON.parse(JSON.stringify(WAITING_DEFAULTS)), partner1Logo: logo, partner2Logo: logo });
    assert.equal(saveSceneConfig('waiting', heavy()), true);
    // Вторая и третья сцены с такими же логотипами уже не влезают.
    assert.equal(saveSceneConfig('partners', heavy()), false);
    assert.equal(saveSceneConfig('finale', heavy()), false);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});
