import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { ref } from 'vue';

async function setup() {
  const requests = [];
  const errors = [];
  const context = vm.createContext({ ref,
    listPluginSearchProviders: async () => [{ id: 'selected', enabled: true }, { id: 'other', enabled: true }],
    searchPluginMusic: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
  });
  const source = readFileSync('src/composables/useOnlineSearch.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
  const { code } = await transform(source, { loader: 'ts' });
  vm.runInContext(code, context);
  const state = context.useOnlineSearch({ loadMoreErrorFallback: () => 'load failed', searchErrorFallback: () => 'search failed', normalizeErrorMessage: e => e.message, onError: e => errors.push(e) });
  return { state, requests, errors };
}

test('selected provider and backend session handle loading without frontend merging', async () => {
  const { state, requests } = await setup();
  const first = state.runOnlineSearch('song', 'selected');
  await new Promise(setImmediate);
  assert.deepEqual(requests[0].args, ['song', 'selected']);
  requests[0].resolve({ sessionId: 'session', tracks: [{ id: 'a' }], isEnd: false });
  await first;
  const more = state.loadMoreOnlineMusic();
  assert.deepEqual(requests[1].args, ['song', 'selected', 'session']);
  requests[1].resolve({ sessionId: 'session', tracks: [{ id: 'a' }, { id: 'b' }], isEnd: true });
  await more;
  assert.deepEqual(state.onlineSearchResults.value.map(t => t.id), ['a', 'b']);
  assert.equal(state.onlineSearchHasMore.value, false);
});

test('late results and errors cannot replace a newer search', async () => {
  const { state, requests, errors } = await setup();
  const old = state.runOnlineSearch('old', 'selected');
  await new Promise(setImmediate);
  const current = state.runOnlineSearch('new', 'other');
  await new Promise(setImmediate);
  requests[1].resolve({ sessionId: 'new', tracks: [{ id: 'new' }], isEnd: false });
  await current;
  requests[0].reject(new Error('old error'));
  await old;
  assert.equal(errors.length, 0);
  const more = state.loadMoreOnlineMusic();
  const newer = state.runOnlineSearch('newer', 'selected');
  await new Promise(setImmediate);
  requests[3].resolve({ sessionId: 'newer', tracks: [{ id: 'newer' }], isEnd: true });
  await newer;
  requests[2].resolve({ sessionId: 'new', tracks: [{ id: 'stale' }], isEnd: false });
  await more;
  assert.equal(state.onlineSearchResults.value[0].id, 'newer');
  assert.equal(state.onlineSearchHasMore.value, false);
});
