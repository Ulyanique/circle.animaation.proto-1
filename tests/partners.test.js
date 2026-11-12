import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTNERS_DEFAULTS} from '../src/scenes/partners.js';
import {sceneById, RECORDING_CHAIN} from '../src/scenes/catalog.js';
import {mergeConfig,configToJSON,parseConfigJSON,projectToJSON,parseProjectJSON} from '../src/config.js';
import {cycleDuration} from '../src/runtime.js';

test('макет спонсоров имеет независимые редактируемые имена и не входит в готовую цепочку',()=>{
  assert.equal(sceneById('partners').status,'preview');
  assert.equal(cycleDuration(PARTNERS_DEFAULTS.timeline),20);
  assert.equal(PARTNERS_DEFAULTS.partners.organizer1,'ПРОэлектро');
  assert.equal(PARTNERS_DEFAULTS.partners.organizer2,'ПРОэлектрощит');
  assert.equal(PARTNERS_DEFAULTS.partners.partner1,'Промрукав');
  assert.equal(PARTNERS_DEFAULTS.partners.partner2,'КЭАЗ');
  assert.ok(!RECORDING_CHAIN.includes('partners'));
  const cfg=mergeConfig(PARTNERS_DEFAULTS,{partners:{partner1:'Компания'}});
  assert.equal(parseConfigJSON(configToJSON(cfg),PARTNERS_DEFAULTS).partners.partner1,'Компания');
  assert.equal(parseProjectJSON(projectToJSON({partners:cfg},['partners']),['partners']).scenes.partners.partners.partner1,'Компания');
  assert.equal(PARTNERS_DEFAULTS.partners.partner1,'Промрукав');
});

test('анимация декора зависит от времени и уважает интенсивность движения', async () => {
  const {partnersCues} = await import('../src/partners-graphics.js');
  const {computePhase} = await import('../src/timeline.js');
  const tl = PARTNERS_DEFAULTS.timeline;
  const at = (t,m=1) => partnersCues(computePhase(t,tl),tl,m);
  assert.equal(at(0).visible,0);
  assert.equal(at(20-1/60).visible,0);
  assert.ok(at(1).title < at(8).title);
  assert.notEqual(at(8).curtainSway,at(10).curtainSway);
  assert.ok(at(2).organizer > at(2).organizerSecond);
  assert.ok(at(4.5).partner > at(4.5).partnerSecond);
  assert.equal(at(1).partner,0);
  assert.equal(at(7).partnerSecond,1);
  assert.ok(at(2).light > 0);
  assert.equal(at(2,0).light,0);
  assert.ok(at(8,0).curtainSway === 0);
  assert.ok(at(8,0).foliageSway === 0);
  assert.deepEqual(at(8),at(8));
});
