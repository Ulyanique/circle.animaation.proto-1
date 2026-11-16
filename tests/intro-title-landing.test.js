import test from 'node:test';
import assert from 'node:assert/strict';
import {introTitleLanding} from '../src/caption-layout.js';
import {WAITING_DEFAULTS} from '../src/scenes/waiting.js';
import {computePhase} from '../src/timeline.js';
import {introSequence} from '../src/scenes/cues.js';

test('посадка названия плавно завершается к концу проявления и может быть выключена', () => {
  const cfg=WAITING_DEFAULTS, tl=cfg.timeline;
  const phase=t=>computePhase(tl.startDelay+t,tl);
  const start=introSequence(phase(0),tl,cfg.intro).captionStart;
  const lift=t=>introTitleLanding(phase(t),tl,start,true);
  assert.equal(lift(start-.01),0);
  assert.equal(lift(start),.75);
  assert.ok(lift(start+.25)>lift(start+.6));
  assert.equal(lift(start+.88),0);
  assert.equal(introTitleLanding(phase(start+.25),tl,start,false),0);
  assert.ok(Math.abs(lift(start+.25)-lift(start+.25+phase(0).cycle)) < 1e-12);
});

test('короткое удержание не даёт скачка в начале ухода', () => {
  const tl={...WAITING_DEFAULTS.timeline,holdDuration:3.5};
  const exit=tl.drawDuration+tl.emergeDuration+tl.holdDuration;
  const phase=t=>computePhase(tl.startDelay+t,tl);
  const start=exit-.1;
  const before=introTitleLanding(phase(exit-1e-5),tl,start,true);
  const after=introTitleLanding(phase(exit+1e-5),tl,start,true);
  assert.ok(before<1e-9); assert.equal(after,0);
});
