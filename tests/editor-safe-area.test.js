import test from 'node:test';
import assert from 'node:assert/strict';
import {safeArea, textBoundsStatus} from '../src/editor-safe-area.js';

test('поля в относительных единицах учитывают размеры и положение кадра', () => {
  const frame = {left:100,top:50,width:1000,height:500};
  assert.deepEqual(safeArea(frame), {left:150,top:75,width:900,height:450});
  assert.equal(textBoundsStatus({left:150,top:75,width:900,height:450},frame),'safe');
  assert.equal(textBoundsStatus({left:110,top:100,width:100,height:40},frame),'margin');
  assert.equal(textBoundsStatus({left:1000,top:100,width:120,height:40},frame),'outside');
  assert.equal(textBoundsStatus({left:200,top:20,width:100,height:40},frame),'outside');
  assert.equal(textBoundsStatus({left:0,top:0,width:0,height:0},frame),'unknown');
  assert.equal(textBoundsStatus({left:0,top:0,width:10,height:10},{...frame,width:0}),'unknown');
});
