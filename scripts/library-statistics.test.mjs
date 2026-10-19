import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { effectScope, nextTick, onScopeDispose, ref, watch } from 'vue';

const { code } = await transform(readFileSync('src/composables/useLibraryStatistics.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

function setup() {
  const requests = [];
  let timer;
  const context = vm.createContext({
    ref, watch, onScopeDispose,
    isTauriRuntime: () => true,
    t: locale => locale === 'en-US' ? 'Unknown artist' : '未知歌手',
    getErrorMessage: error => error.message,
    setTimeout: callback => { timer = callback; return 1; },
    clearTimeout: () => { timer = undefined; },
    readLibraryStatistics: (directories, query, label) => new Promise((resolve, reject) => {
      requests.push({ directories, query, label, resolve, reject });
    }),
  });
  vm.runInContext(code, context);
  const options = { tracks: ref([]), settings: ref({ musicDirs: ['C:/Music'], locale: 'zh-CN' }), query: ref(''), error: ref(null) };
  const scope = effectScope();
  const result = scope.run(() => context.useLibraryStatistics(options));
  return { options, scope, result, requests, runTimer: () => { const callback = timer; timer = undefined; return callback?.(); } };
}

test('new search results cannot be overwritten by a slower previous request', async () => {
  const fixture = setup();
  const old = fixture.runTimer();
  fixture.options.query.value = 'new';
  await nextTick();
  const latest = fixture.runTimer();
  fixture.requests[1].resolve({ artists: [], folders: [], artistCount: 2, artistTrackCount: 3, folderTrackCount: 4 });
  await latest;
  fixture.requests[0].resolve({ artistCount: 99 });
  await old;
  assert.equal(fixture.result.libraryStatistics.value.artistCount, 2);
  assert.equal(fixture.requests[1].query, 'new');
  fixture.scope.stop();
});

test('library and directory updates refresh statistics; disposal ignores in-flight responses', async () => {
  const fixture = setup();
  fixture.options.tracks.value = [{ id: 1, title: 'Updated metadata' }];
  fixture.options.settings.value.musicDirs = ['D:/Music'];
  fixture.options.settings.value.locale = 'en-US';
  await nextTick();
  const pending = fixture.runTimer();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].directories[0], 'D:/Music');
  assert.equal(fixture.requests[0].label, 'Unknown artist');
  fixture.scope.stop();
  fixture.requests[0].resolve({ artistCount: 99 });
  await pending;
  assert.equal(fixture.result.libraryStatistics.value.artistCount, 0);
});
