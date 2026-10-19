import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, ref, reactive } from 'vue';
const compile = async path => (await transform(readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' })).code;

test('collection metadata selects backend statistics for every collection', async () => {
  const context = vm.createContext({ computed, normalizePath: value => value, t: () => '' });
  vm.runInContext(await compile('src/composables/useLibraryCatalog.ts'), context);
  const stats = count => ({ count, totalSeconds: count * 60 });
  const player = reactive({ libraryListStatistics: { tracks: stats(10), latestAddedTracks: stats(2), recentPlayedTracks: stats(3) },
    favoriteStatistics: stats(4), playlists: [{ id: 'p', tracks: [], statistics: stats(5) }],
    libraryStatistics: { folders: [{ path: '/music', filteredCount: 6, filteredTotalSeconds: 360 }] } });
  const options = { player, activeCollection: ref('all'), activeFolderPath: ref(null), activeLibraryFilter: ref('all'), activePlaylistId: ref(null) };
  const result = context.useLibraryCatalog(options);
  assert.equal(result.libraryMeta.value.count, 10);
  options.activeLibraryFilter.value = 'recentAdded'; assert.equal(result.libraryMeta.value.count, 2);
  options.activeLibraryFilter.value = 'recentPlayed'; assert.equal(result.libraryMeta.value.count, 3);
  options.activeCollection.value = 'favorites'; assert.equal(result.libraryMeta.value.totalSeconds, 240);
  options.activePlaylistId.value = 'p'; assert.equal(result.libraryMeta.value.count, 5);
  options.activePlaylistId.value = null; options.activeCollection.value = 'all'; options.activeLibraryFilter.value = 'all'; options.activeFolderPath.value = '/music';
  assert.equal(result.libraryMeta.value.totalSeconds, 360);
});

test('duration display uses server totals and carries rounded minutes into hours', async () => {
  const context = vm.createContext({ computed, songCountLong: (_locale, count) => `${count} songs`,
    durationText: (_locale, hours, minutes) => `${hours}h ${minutes}m`, t: () => 'Library' });
  vm.runInContext(await compile('src/composables/useWorkspaceCollectionDisplay.ts'), context);
  const meta = ref({ count: 7, totalSeconds: 3599, minutes: 60 });
  const result = context.useWorkspaceCollectionDisplay({ activeCollection: ref('favorites'), activeTrack: ref(null),
    isPlaylistView: ref(false), libraryFilter: ref('all'), libraryMeta: meta, libraryTitle: ref(''), locale: ref('en-US'), tracks: ref([]) });
  assert.equal(result.collectionSubtitle.value, '7 songs · 1h 0m · Library');
  meta.value = { count: 0, totalSeconds: 0, minutes: 0 };
  assert.equal(result.collectionSubtitle.value, '0 songs · 0h 0m · Library');
});
