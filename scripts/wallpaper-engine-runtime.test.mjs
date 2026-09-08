import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/composables/useWallpaperEngineBackground.ts'], bundle: true,
  write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'test-dependencies', setup(b) {
    b.onResolve({ filter: /^(vue|@tauri-apps\/api\/core|\.\.\/services\/)/ }, args => ({ path: args.path, namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `module.exports = globalThis.dependencies;`, loader: 'js' }));
  } }] });

function harness(start) {
  const stops = [], classes = new Set(), timers = new Map();
  let callback, read, dispose;
  const sandbox = { exports: {}, console: { error() {}, warn() {} }, dependencies: {
    shallowRef: value => ({ value }), computed: fn => ({ get value() { return fn(); } }),
    watch: (getter, cb) => { read = getter; callback = cb; cb(getter()); },
    onBeforeUnmount: fn => { dispose = fn; },
    isTauriRuntime: () => true, convertFileSrc: id => `http://wallpaper-frame.localhost/${id}`,
    listWallpaperEngineProjects: async () => ({}), startWallpaperEngineScene: start,
    stopWallpaperEngineScene: async id => { stops.push(id); return {}; },
    getWallpaperEngineSceneStatus: async () => ({ active: false, sessionId: '' }),
  }, window: { setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) },
  document: { documentElement: { classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) } } } };
  sandbox.module = { exports: sandbox.exports };
  vm.runInNewContext(compiled.outputFiles[0].text, sandbox);
  const api = sandbox.module.exports;
  const background = { value: { source: 'wallpaper', wallpaperProjectType: 'scene', wallpaperProjectId: 'A', wallpaperRoot: '' } };
  const open = { value: true };
  const state = api.useWallpaperEngineBackground(background, open);
  return { api, state, background, open, stops, classes, timers, change: () => callback(read()), dispose: () => dispose() };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const result = id => ({ active: true, projectId: id, sessionId: `session-${id}` });

test('only activates transparency after the native surface is ready', async () => {
  let ready;
  const h = harness(() => new Promise(resolve => { ready = resolve; }));
  await settle();
  assert.equal(h.api.wallpaperEngineRuntime.value.phase, 'loading');
  assert.equal(h.classes.size, 0);
  ready(result('A')); await settle();
  assert.equal(h.state.sceneActive.value, true);
  assert.match(h.state.frameUrl.value, /session-A$/);
  await [...h.timers.values()][0]();
  assert.equal(h.api.wallpaperEngineRuntime.value.phase, 'error');
  assert.equal(h.classes.size, 0);
  h.dispose();
});

test('closing while startup is pending never reopens the wallpaper', async () => {
  let ready;
  const h = harness(() => new Promise(resolve => { ready = resolve; }));
  await settle();
  h.open.value = false; h.change();
  assert.equal(h.api.wallpaperEngineRuntime.value.phase, 'idle');
  assert.equal(h.stops.length, 2, 'cancel must be sent before the pending start returns');
  ready(result('A')); await settle();
  assert.equal(h.classes.size, 0);
  assert.ok(h.stops.includes('session-A'));
  h.dispose();
});

test('rapid selection changes discard old results and start the latest project', async () => {
  const pending = new Map();
  const h = harness(id => new Promise(resolve => pending.set(id, resolve)));
  await settle();
  h.background.value.wallpaperProjectId = 'B'; h.change();
  pending.get('A')(result('A')); await settle();
  assert.equal(h.api.wallpaperEngineRuntime.value.phase, 'loading');
  pending.get('B')(result('B')); await settle();
  assert.equal(h.api.wallpaperEngineRuntime.value.projectId, 'B');
  assert.ok(h.stops.includes('session-A'));
  h.dispose();
});

test('failure restores an opaque fallback and retry recovers', async () => {
  let fail = true;
  const h = harness(async id => { if (fail) throw new Error('engine unavailable'); return result(id); });
  await settle();
  assert.equal(h.api.wallpaperEngineRuntime.value.phase, 'error');
  assert.equal(h.classes.size, 0);
  fail = false; h.api.retryWallpaperEngineBackground(); h.change(); await settle();
  assert.equal(h.state.sceneActive.value, true);
  h.dispose();
  assert.equal(h.classes.size, 0);
});
