import test from 'node:test';
import assert from 'node:assert/strict';
import { stylePreset, hasWordTiming } from '../src/utils/stylePresets.mjs';

test('style selection replaces conflicting old blur, scale and spacing settings', () => {
  for (const style of ['fan','glow']) {
    const result = {blur:false,scale:false,lineGap:0,fanAngle:45,...stylePreset(style)};
    assert.equal(result.blur,true);
    assert.equal(result.scale,true);
    assert.equal(result.lineGap,.55);
    assert.equal(result.fanAngle,30);
  }
  assert.equal(stylePreset('glow').alignment,'center');
  assert.equal(stylePreset('fan').alignment,'left');
  assert.deepEqual(stylePreset('standard'),{});
});

test('line timestamps must not masquerade as word timing', () => {
  assert.equal(hasWordTiming([{time:10,text:'逐行歌词'}]),false);
  assert.equal(hasWordTiming([{time:10,words:[]}]),false);
  assert.equal(hasWordTiming([{words:[{time:null,text:'字'}]}]),false);
  assert.equal(hasWordTiming([{words:[{time:10,text:'字',duration:.8}]}]),true);
});
