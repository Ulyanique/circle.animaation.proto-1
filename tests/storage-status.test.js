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
