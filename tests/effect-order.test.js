import test from 'node:test';
import assert from 'node:assert/strict';
import { WAITING_DEFAULTS } from '../src/scenes/waiting.js';
import { BRAND_DEFAULTS } from '../src/scenes/brand.js';
import { parseConfigJSON, configToJSON } from '../src/config.js';
import { ORDERABLE_EFFECTS, orderedEffects, effectOrderChanges, applyEffectOrder } from '../src/effect-order.js';
import { DECOR_IDS } from '../src/brand-decor-config.js';
import { PARTICLE_CLOUD_IDS } from '../src/particle-cloud-config.js';
import { BACKGROUND_GLOW_IDS } from '../src/background-glow-config.js';

test('порядок эффектов необязателен, безопасен для старых сцен и независим', () => {
  const cfg=parseConfigJSON('{"decor":{"present":true},"backgroundGlow":{"present":true}}',WAITING_DEFAULTS), other=parseConfigJSON('{}',BRAND_DEFAULTS);
  assert.equal(cfg.effectOrder.enabled,false);assert.equal(orderedEffects(cfg,true).length,2);
  const groups=ids=>Object.fromEntries(ids.map(id=>{ const node={isMesh:true,renderOrder:99}; return [id,{node,group:{traverse:fn=>fn(node)}}]; }));
  const objects={brandDecors:groups(DECOR_IDS),particleClouds:groups(PARTICLE_CLOUD_IDS),backgroundGlows:groups(BACKGROUND_GLOW_IDS)};
  const get=id=>(objects.brandDecors[id]||objects.particleClouds[id]||objects.backgroundGlows[id]).node.renderOrder;
  applyEffectOrder(cfg,objects);for(const id of ORDERABLE_EFFECTS)assert.equal(get(id),0);
  cfg.effectOrder.enabled=true;applyEffectOrder(cfg,objects);assert.ok(get('brandDecor')>get('backgroundGlow'));
  for(const c of effectOrderChanges(cfg,'backgroundGlow','front'))cfg.effectOrder[c.key]=c.value;
  applyEffectOrder(cfg,objects);assert.ok(get('backgroundGlow')>get('brandDecor'));
  assert.equal(other.effectOrder.enabled,false);
  assert.deepEqual(parseConfigJSON(configToJSON(cfg),WAITING_DEFAULTS).effectOrder,cfg.effectOrder);
  assert.deepEqual(effectOrderChanges(cfg,'backgroundGlow','front'),[]);
  cfg.effectOrder.brandDecor=Number.NaN;cfg.effectOrder.backgroundGlow=Number.MAX_VALUE;
  const changes=effectOrderChanges(cfg,'brandDecor','top');
  assert.equal(changes.length,12);for(const c of changes)cfg.effectOrder[c.key]=c.value;
  assert.equal(orderedEffects(cfg).at(-1),'brandDecor');assert.equal(new Set(Object.values(cfg.effectOrder).filter(v=>typeof v==='number')).size,12);
  cfg.effectOrder.enabled=false;applyEffectOrder(cfg,objects);for(const id of ORDERABLE_EFFECTS)assert.equal(get(id),0);
});
