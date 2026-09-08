import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallpaperSampler } from '../src/bridge/wallpaper-sampler.mjs';

test('sampler preserves the last frame, ignores stale loads, and cleans up', () => {
  const saved = new Map(['Image', 'document', 'getComputedStyle', 'innerWidth', 'innerHeight', 'setTimeout', 'clearTimeout'].map(k => [k, globalThis[k]]));
  const images = [], timers = new Map();
  let nextTimer = 0;
  globalThis.Image = class {
    constructor() { this.dataset = {}; this.style = {}; images.push(this); }
    remove() { this.removed = true; }
  };
  const bodyClasses = new Set();
  const body = { classList: {
    toggle(name, active) { if (active) bodyClasses.add(name); else bodyClasses.delete(name); },
  } };
  globalThis.document = { body };
  globalThis.getComputedStyle = () => ({ visibility: 'visible', borderRadius: '30px' });
  globalThis.innerWidth = 1120;
  globalThis.innerHeight = 760;
  globalThis.setTimeout = fn => { timers.set(++nextTimer, fn); return nextTimer; };
  globalThis.clearTimeout = id => timers.delete(id);
  const bar = { getBoundingClientRect: () => ({ left: 40, top: 650, width: 1040, height: 90 }) };
  const layerClasses = new Set();
  const layer = { style: {}, classList: {
    toggle(name, active) { if (active) layerClasses.add(name); else layerClasses.delete(name); },
  }, appendChild(image) { this.child = image; } };
  const root = { querySelector: selector => selector === '#bottom-bar' ? bar
    : selector === '#wallpaper-engine-glass-sampler' ? layer : null };
  const sampler = createWallpaperSampler(root);
  const scene = url => ({ source: 'wallpaper', wallpaperProjectType: 'scene', wallpaperFrameUrl: url });
  try {
    sampler.update(scene('http://wallpaper-frame.localhost/session1'));
    assert.equal(images.length, 1);
    images[0].onload();
    assert.equal(layer.child, images[0]);
    assert.equal(images[0].style.left, undefined);
    assert.equal(images[0].style.width, '100%');
    assert.match(images[0].src, /left=40/);
    assert.match(images[0].src, /viewportWidth=1120/);
    assert.equal(layer.style.width, '1040px');
    assert.equal(layerClasses.has('bar-visible'), true);
    assert.equal(bodyClasses.has('wallpaper-engine-dwm-active'), true);
    assert.equal(bodyClasses.has('wallpaper-engine-glass-sampler-ready'), true);
    sampler.update(scene('http://wallpaper-frame.localhost/session1'));
    assert.equal(images.length, 1, 'progress updates must not restart the sampler');
    const callback = [...timers.values()][0]; timers.clear(); callback();
    images[1].onerror();
    assert.equal(layer.child, images[0], 'failed frame must not flash a broken image');
    const retry = [...timers.values()][0]; timers.clear(); retry();
    const stale = images[2].onload;
    sampler.update(scene('http://wallpaper-frame.localhost/session2'));
    stale();
    assert.equal(images[0].removed, true);
    images[3].onload();
    assert.equal(layer.child, images[3]);
    sampler.update({ source: 'cover' });
    assert.equal(images[3].removed, true);
    assert.equal(layerClasses.has('bar-visible'), false);
    assert.equal(bodyClasses.has('wallpaper-engine-dwm-active'), false);
    assert.equal(timers.size, 0);
    sampler.destroy();
  } finally {
    sampler.destroy();
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
