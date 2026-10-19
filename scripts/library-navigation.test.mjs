import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';
const source = readFileSync('src/composables/useLibraryNavigation.ts', 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });
function navigation() {
 const context = vm.createContext({ ref: value => ({ value }) });
 vm.runInContext(code, context);
 return vm.runInContext('useLibraryNavigation(() => null)', context);
}
test('artist round trip restores music pool selection', () => {
 for (const filter of ['recentPlayed', 'recentAdded']) {
  const nav = navigation();
  nav[filter === 'recentPlayed' ? 'openRecentPlayedInLibrary' : 'openRecentAddedInLibrary']();
  nav.openArtistsView();
  nav.openLibraryView();
  assert.equal(nav.activeLibraryFilter.value, filter);
  assert.equal(nav.isLibraryPanelMode.value, true);
  nav.openLibraryView();
  assert.equal(nav.activeLibraryFilter.value, 'all');
 }
});
test('artist round trip restores folder and downloads', () => {
 const nav = navigation();
 nav.openFolder('D:/music');
 nav.openArtistFromTrack('Artist');
 nav.openLibraryView();
 assert.equal(nav.activeFolderPath.value, 'D:/music');
 nav.openDownloadsView();
 nav.openArtistsView();
 nav.openLibraryView();
 assert.equal(nav.activeView.value, 'downloads');
});
