import test from 'node:test';
import assert from 'node:assert/strict';
import { rendererConfig } from '../src/utils/rendererProfile.mjs';

test('standalone fan stays fan after initial and subsequent host config snapshots', () => {
  for (const config of [{},{lyricStyle:'standard'},{lyricStyle:'glow',fanAngle:-35,lineGap:0}]) {
    const result = rendererConfig(config,true);
    assert.equal(result.lyricStyle,'fan');
    if ('fanAngle' in config) assert.equal(result.fanAngle,-35);
    if ('lineGap' in config) assert.equal(result.lineGap,0);
  }
});
test('BetterLyrics migrates old fan selection while retaining other styles', () => {
  assert.equal(rendererConfig({lyricStyle:'fan'}).lyricStyle,'standard');
  assert.equal(rendererConfig({lyricStyle:'vertical'}).lyricStyle,'vertical');
});

test('fan ignores legacy glow, floating, alignment and background settings', () => {
  const result = rendererConfig({glow:true,float:true,alignment:'center',backgroundMode:'host',fontSize:32,fanAngle:40},true);
  assert.equal(result.glow,false);
  assert.equal(result.float,false);
  assert.equal(result.alignment,'left');
  assert.equal(result.backgroundMode,'fluid');
  assert.equal(result.fontSize,32);
  assert.equal(result.fanAngle,40);
  assert.equal(rendererConfig({glow:true,float:true}).glow,true);
});
