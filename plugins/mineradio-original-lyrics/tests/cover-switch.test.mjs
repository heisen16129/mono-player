import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('late cover callbacks cannot replace or clear the latest host cover', () => {
  const source = readFileSync(new URL('../src/upstream-adapter.js.part', import.meta.url), 'utf8');
  const requests = [];
  const context = vm.createContext({
    state: { trackKey: '', coverKey: '' }, trackSwitchToken: 0,
    uniforms: { uHasCover: { value: 0 } }, currentLocalSong: null,
    keyOf: JSON.stringify, setText() {}, revealPluginVisuals() {},
    document: { getElementById: () => null },
    loadCoverFromUrl: (url, options) => requests.push({ url, options }),
    applyCoverDataUrl: (url, options) => requests.push({ url, options }),
  });
  vm.runInContext(source.slice(source.indexOf('  function applyTrack('), source.indexOf('  function applyQueue(')), context);
  const depth = readFileSync(new URL('../upstream/public/js/modules/02-visual/15-ripples-cover-depth.js', import.meta.url), 'utf8');
  vm.runInContext(depth.slice(depth.indexOf('function coverApplyStillCurrent('), depth.indexOf('function setControlCoverSrc(')), context);
  const track = (id, cover) => context.applyTrack({ track: { id, name: id, cover } });
  track('a', 'https://example.com/a.jpg');
  track('b', 'https://example.com/b.jpg');
  track('b', 'data:image/png;base64,latest');
  assert.equal(context.coverApplyStillCurrent(requests[0].options), false);
  assert.equal(context.coverApplyStillCurrent(requests[1].options), false);
  assert.equal(context.coverApplyStillCurrent(requests[2].options), true);
  assert.equal(requests[2].options.noCoverTransition, true);
  track('b', 'data:image/png;base64,latest');
  assert.equal(requests.length, 3);
  context.uniforms.uHasCover.value = 1;
  track('c', 'https://example.com/c.jpg');
  assert.equal(requests[3].options.noCoverTransition, false);
});
