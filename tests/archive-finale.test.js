import test from 'node:test';
import assert from 'node:assert/strict';
import {finalLightPoint,finaleState,FINAL_LIGHT_ARRIVAL,FINAL_LIGHT_START} from '../src/archive/finale-motion.js';
import {ARCHIVE_DURATION,FINALE_START} from '../src/archive/motion.js';
test('свет приходит к знаку из проекции и продолжает движение в финале',()=>{
  const start={x:320,y:680};
  assert.deepEqual(finalLightPoint(FINAL_LIGHT_START,start),start);
  assert.deepEqual(finalLightPoint(FINAL_LIGHT_ARRIVAL,start),{x:960,y:335});
  assert.notDeepEqual(finalLightPoint(7,start),finalLightPoint(3,start));
  assert.deepEqual(finalLightPoint(3,start),finalLightPoint(3,start));
  assert.equal(finaleState(7).light,1);
});
test('финальный знак и название удерживаются до затемнения',()=>{
  assert.equal(ARCHIVE_DURATION-FINALE_START,9);
  assert.equal(finaleState(3.65).title,1);
  assert.equal(finaleState(8.2).closing,0);
  assert.equal(finaleState(9).closing,1);
});
