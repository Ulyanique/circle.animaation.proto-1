import test from 'node:test';
import assert from 'node:assert/strict';
import {captionDrift} from '../src/caption-layout.js';

test('смещение титра одинаково относительно кадра при любом размере окна', () => {
  for (const [progress, centered] of [[0,0], [.4,0], [.4,.5], [1,0], [0,1]]) {
    assert.equal(captionDrift(progress, centered, 540) * 2, captionDrift(progress, centered, 1080));
  }
  assert.equal(captionDrift(1, 0, 1080), 0);
  assert.equal(captionDrift(0, 1, 1080), 0);
});
