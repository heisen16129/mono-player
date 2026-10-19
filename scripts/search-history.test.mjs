import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { effectScope, ref, watch, nextTick } from 'vue';
const { code } = await transform(readFileSync('src/composables/useSearchHistory.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

test('serializes mutations, uses backend results and survives a failed request', async () => {
  const calls = [];
  const context = vm.createContext({ ref, watch, console,
    updateSearchHistory: (...args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
  });
  vm.runInContext(code, context);
  const limit = ref(10);
  const scope = effectScope();
  const history = scope.run(() => context.useSearchHistory(limit));
  const save = history.saveSearchHistory(' song ');
  const clear = history.clearSearchHistory();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['record', 10, ' song ']);
  calls[0].resolve(['song']); await save;
  assert.deepEqual([...history.searchHistory.value], ['song']);
  await Promise.resolve();
  assert.equal(calls[1].args[0], 'clear');
  calls[1].resolve([]); await clear;
  assert.equal(history.searchHistory.value.length, 0);
  const failed = history.removeSearchHistory('song');
  await Promise.resolve(); calls[2].reject(new Error('database unavailable'));
  await assert.rejects(failed, /database unavailable/);
  const load = history.loadSearchHistory();
  await Promise.resolve(); calls[3].resolve(['backend']); await load;
  assert.deepEqual([...history.searchHistory.value], ['backend']);
  limit.value = 5; await nextTick(); await Promise.resolve();
  assert.deepEqual(calls[4].args, ['list', 5, undefined]);
  calls[4].resolve([]);
  scope.stop();
});
