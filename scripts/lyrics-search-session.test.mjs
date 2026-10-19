import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { ref, computed } from 'vue';

async function setup() {
  const requests = [];
  const context = vm.createContext({ ref, computed,
    getErrorMessage: e => e.message,
    pluginSearchTrackKey: t => `${t.providerId}:${t.id}`,
    listPluginLyricSearchProviders: async () => [{ id: 'a', enabled: true }, { id: 'b', enabled: true }],
    searchPluginLyricsFromProviders: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
  });
  const source = readFileSync('src/composables/useLyricsSearch.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
  const { code } = await transform(source, { loader: 'ts' });
  vm.runInContext(code, context);
  return { state: context.useLyricsSearch({ defaultQuery: () => 'song' }), requests };
}
const scroll = state => state.handleLyricSearchResultsScroll({ currentTarget: { scrollHeight: 100, scrollTop: 90, clientHeight: 10 } });
const tick = () => new Promise(setImmediate);

test('lyrics load uses submitted query and session, preserves results on failure, retries and honors end', async () => {
  const { state, requests } = await setup();
  const open = state.openLyricSearchDialog(); await tick();
  requests[0].resolve({ sessionId: 's', tracks: [{ id: 'one' }], isEnd: false }); await open;
  state.lyricSearchQuery.value = 'unsubmitted';
  scroll(state);
  assert.deepEqual(requests[1].args, ['song', 'a', 's']);
  requests[1].reject(new Error('network')); await tick();
  assert.equal(state.lyricSearchResults.value[0].id, 'one');
  assert.equal(state.lyricSearchStatus.value, 'network');
  scroll(state);
  assert.deepEqual(requests[2].args, requests[1].args);
  requests[2].resolve({ sessionId: 's', tracks: [{ id: 'one' }, { id: 'two' }], isEnd: true }); await tick();
  assert.equal(state.lyricSearchResults.value.length, 2);
  scroll(state); assert.equal(requests.length, 3);
});

test('changing lyrics provider and closing dialog ignore late responses', async () => {
  const { state, requests } = await setup();
  const open = state.openLyricSearchDialog(); await tick();
  const change = state.selectLyricSearchProvider('b');
  requests[1].resolve({ sessionId: 'b', tracks: [{ id: 'new' }], isEnd: false }); await change;
  requests[0].resolve({ sessionId: 'a', tracks: [{ id: 'old' }], isEnd: false }); await open;
  assert.equal(state.lyricSearchResults.value[0].id, 'new');
  scroll(state); state.closeLyricSearchDialog();
  requests[2].reject(new Error('late')); await tick();
  assert.equal(state.lyricSearchStatus.value, '');
  assert.equal(state.isSearchingPluginLyrics.value, false);
});
