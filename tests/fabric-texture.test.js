import test from 'node:test';
import assert from 'node:assert/strict';
import { Background } from '../src/fx.js';
import { SCHEMA, mergeConfig, configToJSON, parseConfigJSON } from '../src/config.js';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { PHOTO_PAUSE_DEFAULTS } from '../src/scenes/photo-pause.js';
import { FINALE_DEFAULTS } from '../src/scenes/finale.js';

test('каменная фактура регулируется и хранится независимо от других сцен', () => {
  assert.equal(WAITING_DEFAULTS.background.fabricTexture, .8);
  assert.equal(BRAND_DEFAULTS.background.fabricTexture, .8);
  for (const defaults of [PHOTO_PAUSE_DEFAULTS, FINALE_DEFAULTS]) {
    assert.equal(defaults.background.fabricTexture, BRAND_DEFAULTS.background.fabricTexture);
    assert.equal(defaults.background.cinematicLight, true);
  }
  assert.ok(SCHEMA.find(s => s.id === 'background').fields.some(f => f.key === 'fabricTexture' && f.type === 'range'));
  const cfg = mergeConfig(WAITING_DEFAULTS, {}), bg = new Background();
  for (const [value, expected] of [[0,0], [.42,.42], [2,1], [-1,0]]) {
    cfg.background.fabricTexture = value; bg.update(10, cfg);
    assert.equal(bg.uniforms.uFabricTexture.value, expected);
  }
  cfg.background.fabricTexture = .37;
  assert.equal(parseConfigJSON(configToJSON(cfg), WAITING_DEFAULTS).background.fabricTexture, .37);
  assert.equal(parseConfigJSON('{"background":{"fog":0.2}}', WAITING_DEFAULTS).background.fabricTexture, .8);
  bg.mesh.geometry.dispose(); bg.material.dispose();
});


test('фон фото и финала обновляется один раз без изменения других настроек и импорта', async () => {
  const {loadSceneConfig,saveSceneConfig,sceneStorageKey}=await import('../src/config.js');
  const data=new Map(), previous=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
  try {
    for (const [id,defaults] of [['photo-pause',PHOTO_PAUSE_DEFAULTS],['finale',FINALE_DEFAULTS]]) {
      data.clear();data.set(sceneStorageKey(id),JSON.stringify({background:{fabricTexture:0,fog:.23},logo:{scale:.71}}));
      let cfg=loadSceneConfig(id,defaults);
      assert.equal(cfg.background.fabricTexture,.8);assert.equal(cfg.background.fog,.23);assert.equal(cfg.logo.scale,.71);
      cfg.background.fabricTexture=0;saveSceneConfig(id,cfg);
      assert.equal(loadSceneConfig(id,defaults).background.fabricTexture,0);
      data.clear();data.set(sceneStorageKey(id),JSON.stringify({background:{fabricTexture:.3}}));
      assert.equal(loadSceneConfig(id,defaults).background.fabricTexture,.3);
      assert.equal(parseConfigJSON('{"background":{"fabricTexture":0}}',defaults).background.fabricTexture,0);
    }
  } finally {globalThis.localStorage=previous;}
});
