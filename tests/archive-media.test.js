import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClipTime,formatClipTime,validateClipRange,clipTarget,sourceRange} from '../src/archive/clip-range.js';
import {mediaFit,mediaOffset,MEDIA_FRAME_ASPECT} from '../src/archive/media-fit.js';

test('таймкод и реальные границы фрагмента не выходят за длину источника',()=>{
  assert.equal(parseClipTime('01:25'),85);assert.equal(parseClipTime('1:02:03.5'),3723.5);
  assert.equal(parseClipTime('1:60'),null);assert.equal(parseClipTime('-1'),null);
  assert.equal(formatClipTime(85.5),'1:25.5');assert.equal(parseClipTime(formatClipTime(85.5)),85.5);
  assert.equal(validateClipRange(1,4,3),false);assert.equal(validateClipRange(2,2,3),false);
  assert.deepEqual(sourceRange('01:25–01:28',300),{start:85,end:88});
  assert.deepEqual(sourceRange('03:34',300),{start:214,end:300});
  assert.equal(sourceRange('01:25–01:28',20),null);
  assert.equal(clipTarget(0,85,88),85);assert.equal(clipTarget(1,85,88),86);
  assert.equal(clipTarget(10,85,88),88-1/30);
});
test('кадрирование горизонтального и квадратного медиа без искажения',()=>{
  for(const aspect of [16/9,1]){
    const a=mediaFit(aspect,'contain');assert.ok(Math.abs(MEDIA_FRAME_ASPECT*a.scaleX/a.scaleY-aspect)<1e-9);
    assert.equal(a.repeatX,1);assert.equal(a.repeatY,1);
    const b=mediaFit(aspect,'cover');assert.equal(b.scaleX,1);assert.equal(b.scaleY,1);
    assert.ok(Math.abs(aspect*b.repeatX/b.repeatY-MEDIA_FRAME_ASPECT)<1e-9);
  }
});


test('смещение кадра ограничено видимой областью и сохраняет вписывание',()=>{
  const f=mediaFit(16/9,'cover');
  assert.deepEqual(mediaOffset(f,0,0),{x:0,y:0});
  assert.deepEqual(mediaOffset(f,1,1),{x:1-f.repeatX,y:1-f.repeatY});
  assert.deepEqual(mediaOffset(f,-5,9),{x:0,y:1-f.repeatY});
  assert.deepEqual(mediaOffset(mediaFit(1,'contain'),1,0),{x:0,y:0});
  assert.deepEqual(mediaOffset(f,NaN,NaN),mediaOffset(f,.5,.5));
});


test('блик на медиаграни привязан к локальной позиции света и плавно затухает',async()=>{
  const {mediaLight}=await import('../src/archive/media-light.js');
  assert.deepEqual(mediaLight(0,0,0),{x:.5,y:.5,strength:.14});
  assert.equal(mediaLight(0,0,7).strength,0);
  assert.equal(mediaLight(0,0,-7).strength,0);
  assert.equal(mediaLight(0,0,0,0).strength,0);
  assert.ok(mediaLight(0,0,3).strength<mediaLight(0,0,1).strength);
  assert.deepEqual(mediaLight(1,2,3),mediaLight(1,2,3));
});
