import test from 'node:test';
import assert from 'node:assert/strict';
import {captionFitFactor} from '../src/caption-fit.js';
import {SCENES} from '../src/scenes/catalog.js';
import {parseConfigJSON, configToJSON, projectToJSON, parseProjectJSON} from '../src/config.js';

test('автоподгонка только уменьшает строку и учитывает горизонтальное смещение', () => {
  assert.equal(captionFitFactor(1000, 400), 1);
  assert.equal(captionFitFactor(1000, 1800), .5);
  assert.equal(captionFitFactor(1000, 1000, .2), .5);
  assert.equal(captionFitFactor(1000, 1000, -.2), .5);
  assert.equal(captionFitFactor(1000, 1000, .45), .1);
  assert.equal(captionFitFactor(0, 1000), 1);
  assert.equal(captionFitFactor(1000, 0), 1);
});
test('автоподгонка выключена в старых сценах и хранится независимо', () => {
  const scenes = SCENES.filter(s=>s.defaults), ids = scenes.map(s=>s.id);
  const configs = Object.fromEntries(scenes.map(s=>[s.id,parseConfigJSON('{}',s.defaults)]));
  for (const cfg of Object.values(configs)) for (const name of ['title','subtitle','date']) assert.equal(cfg.caption[`${name}AutoFit`], false);
  configs.waiting.caption.titleAutoFit = true;
  assert.equal(configs.finale.caption.titleAutoFit, false);
  assert.equal(parseConfigJSON(configToJSON(configs.waiting),scenes[0].defaults).caption.titleAutoFit,true);
  assert.equal(parseProjectJSON(projectToJSON(configs,ids),ids).scenes.waiting.caption.titleAutoFit,true);
});
