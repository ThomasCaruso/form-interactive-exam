const assert = require('node:assert/strict');
require('./test-product-loop.cjs');
const { canShowSwipeHint } = require('../src/domain/discoveryGesture.ts');
assert.equal(typeof canShowSwipeHint, 'function');
const ready = { focused: true, active: true, reduced: false, touched: false, locked: false, played: false };
assert.equal(canShowSwipeHint(ready), true);
for (const [key,value] of [['focused',false],['active',false],['reduced',true],['touched',true],['locked',true],['played',true]]) {
  assert.equal(canShowSwipeHint({ ...ready, [key]: value }), false, key + ' must suppress the cue');
}
console.log('PASS: swipe hint respects focus, app state, motion preference and interaction');
