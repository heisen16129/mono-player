import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/components/lyrics/renderers/ExternalLyricsRenderer.vue', import.meta.url), 'utf8');
const load = source.slice(source.indexOf('async function loadSandboxEntry()'), source.indexOf('function createSandboxDocument('));
const unmount = source.match(/onBeforeUnmount\(\(\) => \{([\s\S]*?)\n\}\);/)[1];
const { code } = await transform(load, { loader: 'ts' });

for (const outcome of ['resolve', 'reject']) {
  test(`unmounted renderer ignores late ${outcome}`, async () => {
    let resolve, reject;
    const request = new Promise((yes, no) => { resolve = yes; reject = no; });
    const selections = [];
    const state = {
      loadGeneration: 0, props: { entry: 'https://example.com/renderer.mjs' },
      loadError: { value: '' }, sandboxEntry: { value: '' }, sandboxModuleSource: { value: null },
      invokeApi: () => request, selectLyricsRenderer: id => selections.push(id),
      console: { error() {} }, audioFrameDisposed: false, unlistenAudioFrame: null,
      window: { removeEventListener() {} }, handleMessage() {},
    };
    vm.createContext(state);
    vm.runInContext(code, state);
    const pending = vm.runInContext('loadSandboxEntry()', state);
    vm.runInContext(unmount, state);
    if (outcome === 'resolve') resolve('export default {}');
    else reject(new Error('old request failed'));
    await pending;
    assert.deepEqual(selections, []);
    assert.equal(state.loadError.value, '');
    assert.equal(state.sandboxModuleSource.value, null);
    assert.equal(state.sandboxEntry.value, '');
  });
}
