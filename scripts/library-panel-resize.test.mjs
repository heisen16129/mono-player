import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync('src/composables/useLibraryPanelResize.ts', 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });

test('library panel collapses, persists and reopens from the edge', async () => {
  const listeners = new Map();
  let stored = 260;
  let frame;
  const context = vm.createContext({
    ref: (value) => ({ value }),
    computed: (get) => ({ get value() { return get(); } }),
    onBeforeUnmount: () => {},
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { frame = callback; return 1; },
    cancelAnimationFrame: () => { frame = undefined; },
    readPersistentValue: async () => stored,
    writePersistentValue: async (_key, value) => { stored = value; },
    document: { body: { classList: { add() {}, remove() {} } } },
    window: {
      matchMedia: () => ({ matches: false }),
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
    },
  });
  vm.runInContext(code, context);
  const panel = vm.runInContext('useLibraryPanelResize()', context);
  const start = (x) => panel.startLibraryPanelResize({ button: 0, clientX: x, preventDefault() {}, stopPropagation() {} });
  start(260);
  listeners.get('pointermove')({ clientX: 240 });
  assert.equal(panel.appGridStyle.value['--library-width'], '240px');
  listeners.get('pointermove')({ clientX: 200 });
  assert.equal(panel.appGridStyle.value['--library-width'], '220px');
  listeners.get('pointermove')({ clientX: 180 });
  assert.equal(panel.appGridStyle.value['--library-width'], '220px');
  listeners.get('pointermove')({ clientX: 160 });
  assert.equal(panel.appGridStyle.value['--library-width'], '220px');
  assert.equal(frame, undefined);
  listeners.get('pointermove')({ clientX: 136 });
  assert.equal(panel.appGridStyle.value['--library-width'], '220px');
  frame(120);
  assert.ok(parseFloat(panel.appGridStyle.value['--library-width']) > 0);
  assert.ok(parseFloat(panel.appGridStyle.value['--library-width']) < 220);
  assert.equal(panel.appGridStyle.value['--library-panel-visibility'], 'visible');
  frame(240);
  assert.equal(panel.appGridStyle.value['--library-width'], '0px');
  assert.equal(panel.appGridStyle.value['--library-panel-visibility'], 'hidden');
  listeners.get('pointerup')();
  assert.equal(stored, 0);
  await panel.loadLibraryPanelWidth();
  assert.equal(panel.appGridStyle.value['--library-width'], '0px');
  start(0);
  listeners.get('pointermove')({ clientX: 25 });
  // A frame timestamp can precede performance.now() when requested in that frame.
  frame(-2);
  assert.equal(panel.appGridStyle.value['--library-width'], '0px');
  frame(120);
  assert.ok(parseFloat(panel.appGridStyle.value['--library-width']) > 0);
  assert.ok(parseFloat(panel.appGridStyle.value['--library-width']) < 220);
  frame(240);
  assert.equal(panel.appGridStyle.value['--library-width'], '220px');
  assert.equal(panel.appGridStyle.value['--library-panel-visibility'], 'visible');
  listeners.get('pointermove')({ clientX: 500 });
  assert.equal(panel.appGridStyle.value['--library-width'], '260px');
  listeners.get('pointerup')();
});
