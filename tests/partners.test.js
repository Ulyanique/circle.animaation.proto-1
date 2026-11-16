import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTNERS_DEFAULTS} from '../src/scenes/partners.js';
import {sceneById, RECORDING_CHAIN} from '../src/scenes/catalog.js';
import {mergeConfig,configToJSON,parseConfigJSON,projectToJSON,parseProjectJSON} from '../src/config.js';
import {cycleDuration} from '../src/runtime.js';

test('макет спонсоров имеет независимые редактируемые имена и не входит в готовую цепочку',()=>{
  assert.equal(sceneById('partners').status,'preview');
  assert.equal(cycleDuration(PARTNERS_DEFAULTS.timeline),20);
  assert.equal(PARTNERS_DEFAULTS.partners.title,'ЯНТАРНЫЙ ЦИРКУЛЬ');
  assert.equal(PARTNERS_DEFAULTS.partners.organizerLabel,'ОРГАНИЗАТОР');
  assert.equal(PARTNERS_DEFAULTS.partners.coorganizerLabel,'СООРГАНИЗАТОР');
  assert.equal(PARTNERS_DEFAULTS.partners.partnerLabel,'СПОНСОРЫ');
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
  assert.ok(at(1).frame < at(3).frame);
  assert.ok(at(17.6).frame < at(16).frame);
  assert.equal(at(20-1/60).frame,0);
  assert.notEqual(at(8).backgroundX,at(10).backgroundX);
  assert.equal(at(8,0).backgroundX,at(10,0).backgroundX);
  assert.equal(at(8,0).backgroundGlow,0);
  assert.notEqual(at(8).curtainSway,at(10).curtainSway);
  assert.ok(at(.5).frame > at(.5).title);
  assert.ok(at(2).title > at(2).organizer);
  assert.ok(at(2).organizer > at(2).organizerSecond);
  assert.ok(at(3).organizerLabel > at(3).coorganizerLabel);
  assert.ok(at(4.5).partner > at(4.5).partnerSecond);
  assert.equal(at(1).partner,0);
  assert.equal(at(7).partnerSecond,1);
  assert.ok(at(2).light > 0);
  assert.equal(at(2,0).light,0);
  assert.ok(at(8,0).curtainSway === 0);
  assert.ok(at(8,0).foliageSway === 0);
  assert.deepEqual(at(8),at(8));
});


test('прежний стандартный заголовок партнёров переносится один раз, свои подписи сохраняются', async () => {
  const {loadSceneConfig,saveSceneConfig,sceneStorageKey}=await import('../src/config.js');
  const data=new Map(),previous=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
  try {
    data.set(sceneStorageKey('partners'),JSON.stringify({partners:{partnerLabel:'ПАРТНЁРЫ',organizer1:'Своя компания'}}));
    let cfg=loadSceneConfig('partners',PARTNERS_DEFAULTS);
    assert.equal(cfg.partners.partnerLabel,'СПОНСОРЫ');assert.equal(cfg.partners.coorganizerLabel,'СООРГАНИЗАТОР');assert.equal(cfg.partners.organizer1,'Своя компания');
    cfg.partners.partnerLabel='ПАРТНЁРЫ';saveSceneConfig('partners',cfg);
    assert.equal(loadSceneConfig('partners',PARTNERS_DEFAULTS).partners.partnerLabel,'ПАРТНЁРЫ');
    data.clear();data.set(sceneStorageKey('partners'),JSON.stringify({partners:{partnerLabel:'НАШИ ДРУЗЬЯ'}}));
    assert.equal(loadSceneConfig('partners',PARTNERS_DEFAULTS).partners.partnerLabel,'НАШИ ДРУЗЬЯ');
    assert.equal(parseConfigJSON('{"partners":{"partnerLabel":"ПАРТНЁРЫ"}}',PARTNERS_DEFAULTS).partners.partnerLabel,'ПАРТНЁРЫ');
  } finally {globalThis.localStorage=previous;}
});


test('стандартное название сцены становится прописным только при первой загрузке', async () => {
  const {loadSceneConfig,saveSceneConfig,sceneStorageKey}=await import('../src/config.js');
  const data=new Map(),previous=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
  try {
    data.set(sceneStorageKey('partners'),JSON.stringify({partners:{title:'Янтарный циркуль'}}));
    let cfg=loadSceneConfig('partners',PARTNERS_DEFAULTS);
    assert.equal(cfg.partners.title,'ЯНТАРНЫЙ ЦИРКУЛЬ');
    cfg.partners.title='Янтарный циркуль';saveSceneConfig('partners',cfg);
    assert.equal(loadSceneConfig('partners',PARTNERS_DEFAULTS).partners.title,'Янтарный циркуль');
    data.clear();data.set(sceneStorageKey('partners'),JSON.stringify({partners:{title:'Своё название'}}));
    assert.equal(loadSceneConfig('partners',PARTNERS_DEFAULTS).partners.title,'Своё название');
    assert.equal(parseConfigJSON('{"partners":{"title":"Янтарный циркуль"}}',PARTNERS_DEFAULTS).partners.title,'Янтарный циркуль');
  } finally {globalThis.localStorage=previous;}
});


test('раскрытие и блик логотипов определяются временем без истории кадров', async () => {
  const {partnersLogoMotion}=await import('../src/partners-logo-motion.js');
  const first=partnersLogoMotion(0,0,2.6,0), middle=partnersLogoMotion(.5,2.5,2.6,0);
  const done=partnersLogoMotion(1,8,2.6,0);
  assert.equal(first.opacity,0);assert.ok(first.scale<middle.scale && middle.scale<done.scale);
  assert.ok(first.offsetY>middle.offsetY && middle.offsetY>done.offsetY);
  assert.equal(done.reveal,1);assert.equal(done.scale,1);
  assert.equal(partnersLogoMotion(1,8,2.6,0,0).sweep,-1);
  for (let i=0;i<4;i++) {
    const end=2.6*[1.5,1.8,2.3,2.55][i];
    assert.equal(partnersLogoMotion(1,end,2.6,i).sweep,-1);
    assert.ok(partnersLogoMotion(1,end+.45+i*.18+.3,2.6,i).sweep>=0);
  }
  assert.deepEqual(partnersLogoMotion(.5,2.5,2.6,0),middle);
});
