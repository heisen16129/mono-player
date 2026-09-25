import test from 'node:test';
import assert from 'node:assert/strict';
import { configWithDefaults } from '../src/state.mjs';
import { fanPosition, fanTransform, wordEffect } from '../src/utils/lyricEffects.mjs';

test('every visible fan anchor shares one circle and radial direction', () => {
  for (const height of [400,700,1000]) for (const angle of [-45,-30,30,45]) {
    const sign = Math.sign(angle);
    const radius = fanPosition(0,height,angle).radius;
    for (const offset of [-.45,-.3,-.15,0,.15,.3,.55].map(value=>value*height)) {
      const point = fanPosition(offset,height,angle);
      assert.equal(point.radius,radius);
      assert.ok(Math.abs(Math.hypot(point.x + sign*radius,offset)-radius) < 1e-8);
      assert.ok(Math.abs(Math.tan(point.angle*Math.PI/180)-offset/(point.x+sign*radius)) < 1e-8);
    }
  }
});

test('fan is symmetric and independent of line length; zero and reduced motion stay level', () => {
  const upper = fanPosition(-160,700,45), lower = fanPosition(160,700,45);
  assert.equal(upper.x,lower.x);
  assert.equal(upper.angle,-lower.angle);
  assert.deepEqual(fanPosition(160,700,0),{x:0,angle:0,radius:Infinity});
  assert.equal(fanTransform(100,700,configWithDefaults(),true),'none');
});

test('unplayed characters sink, rise in 450ms and stay on the baseline', () => {
  const config = configWithDefaults();
  const sample = elapsed => wordEffect(elapsed,1,config,false,{lineElapsed:elapsed+2,lineDuration:5});
  assert.equal(sample(-.5).lift,8);
  assert.equal(sample(0).lift,8);
  assert.ok(sample(.2).lift > 0 && sample(.2).lift < 8);
  assert.equal(sample(.45).lift,0);
  assert.equal(sample(1.2).lift,0);
  assert.equal(wordEffect(0,1,config,true).lift,0);
});
test('long-note glow grows through the note and releases after it', () => {
  const config = configWithDefaults();
  const sample = elapsed => wordEffect(elapsed,1,config,false,{lineElapsed:elapsed+1,lineDuration:4});
  assert.ok(sample(.8).glow > sample(.5).glow);
  assert.equal(sample(1).glow,8);
  assert.ok(sample(1.1).glow > 0);
  assert.equal(sample(1.35).glow,0);
  assert.equal(sample(1).scale,1.15);
  assert.equal(wordEffect(.1,.2,config).glow,0);
  assert.equal(wordEffect(.5,1,{...config,glow:false}).glow,0);
});
test('line glow persists on played text; final notes release before the line ends', () => {
  const config = configWithDefaults({glowScope:'all'});
  assert.equal(wordEffect(2,.2,config,false,{lineElapsed:3,lineDuration:5}).glow,8);
  assert.equal(wordEffect(4,.2,config,false,{lineElapsed:5,lineDuration:5}).glow,0);
  const long = configWithDefaults();
  assert.equal(wordEffect(1,1,long,false,{lineElapsed:1,lineDuration:1}).glow,0);
  assert.equal(wordEffect(.5,1,long,true).scale,1);
});
