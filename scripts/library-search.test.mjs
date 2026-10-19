import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, effectScope, nextTick, onScopeDispose, ref, watch } from 'vue';

const { code } = await transform(readFileSync('src/composables/useLibrarySearch.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

function setup() {
  const requests = [];
  let timer;
  const context = vm.createContext({
    computed, ref, watch, onScopeDispose,
    isTauriRuntime: () => true,
    getErrorMessage: error => error.message,
    setTimeout: callback => { timer = callback; return 1; },
    clearTimeout: () => { timer = undefined; },
    searchLibrary: query => new Promise((resolve, reject) => requests.push({ query, resolve, reject })),
  });
  vm.runInContext(code, context);
  const options = { tracks: ref([]), latestAddedTracks: ref([]), recentPlayedTracks: ref([]), query: ref(''), error: ref(null) };
  const scope = effectScope();
  const result = scope.run(() => context.useLibrarySearch(options));
  return { options, scope, result, requests, runTimer: () => { const callback = timer; timer = undefined; return callback?.(); } };
}

test('all three lists use backend results and ignore outdated search responses', async () => {
  const f = setup();
  const old = f.runTimer();
  f.options.query.value = 'album';
  await nextTick();
  const latest = f.runTimer();
  assert.equal(f.requests[1].query, 'album');
  f.requests[1].resolve({ tracks: [{ id: 5 }], latestAddedTracks: [{ id: 6 }], recentPlayedTracks: [{ id: 7 }] });
  await latest;
  f.requests[0].resolve({ tracks: [], latestAddedTracks: [], recentPlayedTracks: [] });
  await old;
  assert.equal(f.result.filteredTracks.value[0].id, 5);
  assert.equal(f.result.filteredLatestAddedTracks.value[0].id, 6);
  assert.equal(f.result.filteredRecentPlayedTracks.value[0].id, 7);
  f.scope.stop();
});

test('playback history changes refresh results; disposing ignores pending requests', async () => {
  const f = setup();
  f.options.recentPlayedTracks.value = [{ id: 1, lastPlayedAt: 42 }];
  await nextTick();
  const pending = f.runTimer();
  assert.equal(f.requests.length, 1);
  f.scope.stop();
  f.requests[0].resolve({ tracks: [{ id: 1 }], latestAddedTracks: [], recentPlayedTracks: [{ id: 1 }] });
  await pending;
  assert.equal(f.result.filteredTracks.value.length, 0);
});
