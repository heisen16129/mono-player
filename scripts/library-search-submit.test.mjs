import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue';

for (const path of ['src/components/WorkspaceSearchToolbar.vue', 'src/components/artists/ArtistSearchToolbar.vue']) {
  test(`${path}: typing does not submit; Enter submits and empty submission clears search`, async () => {
    const source = readFileSync(path, 'utf8');
    const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const { code } = await transform(script.replace(/^import .*;\r?\n/gm, ''), { loader: 'ts' });
    const props = reactive({ modelValue: 'old', placeholder: '' });
    const emitted = [];
    const context = vm.createContext({ ref, watch, defineProps: () => props, defineEmits: () => (...args) => emitted.push(args) });
    const scope = effectScope();
    scope.run(() => vm.runInContext(code + '\nglobalThis.state = { draftQuery, submitSearch };', context));
    context.state.draftQuery.value = 'new';
    await nextTick();
    assert.deepEqual(emitted, []);
    assert.equal(props.modelValue, 'old');
    context.state.submitSearch('new');
    assert.deepEqual(emitted, [['update:modelValue', 'new']]);
    context.state.submitSearch('');
    assert.deepEqual(emitted[1], ['update:modelValue', '']);
    props.modelValue = 'external';
    await nextTick();
    assert.equal(context.state.draftQuery.value, 'external');
    assert.match(source, /@submit="submitSearch"/);
    assert.match(source, /@update:model-value="draftQuery = \$event"/);
    scope.stop();
  });
}

test('sidebar recent counts remain totals while search results change', async () => {
  const player = reactive({ libraryListTotals: { latestAddedTracks: { count: 2 }, recentPlayedTracks: { count: 2 } }, latestAddedTracks: [{ id: 1 }, { id: 2 }], recentPlayedTracks: [{ id: 3 }, { id: 4 }],
    filteredLatestAddedTracks: [], filteredRecentPlayedTracks: [], filteredTracks: [],
    libraryStatistics: { artists: [], folders: [] } });
  const context = vm.createContext({ computed, usePlayerStore: () => player, defineProps: () => ({}), defineEmits: () => () => {},
    t: () => '', normalizePath: value => value });
  const catalog = readFileSync('src/composables/useLibraryCatalog.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
  const panel = readFileSync('src/components/LibraryPanel.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?\n/gm, '');
  for (const source of [catalog, panel]) {
    const { code } = await transform(source, { loader: 'ts' });
    vm.runInContext(code, context);
  }
  context.options = { player, activeCollection: ref('all'), activeFolderPath: ref(null), activeLibraryFilter: ref('all'), activePlaylistId: ref(null) };
  const result = vm.runInContext('useLibraryCatalog(options)', context);
  assert.equal(result.recentAddedTrackCount.value, 2);
  assert.equal(vm.runInContext('recentPlayedCount.value', context), 2);
  player.filteredLatestAddedTracks = [{ id: 1 }];
  player.filteredRecentPlayedTracks = [{ id: 3 }];
  assert.equal(result.recentAddedTrackCount.value, 2);
  assert.equal(vm.runInContext('recentPlayedCount.value', context), 2);
  assert.equal(result.recentAddedVisibleTracks.value.length, 1);
  player.recentPlayedTracks.push({ id: 5 });
  player.libraryListTotals.recentPlayedTracks.count = 3;
  assert.equal(vm.runInContext('recentPlayedCount.value', context), 3);
});
