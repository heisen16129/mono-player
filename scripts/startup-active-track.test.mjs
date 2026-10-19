import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, ref } from 'vue';
const { code } = await transform(readFileSync('src/composables/useActiveTrackState.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

test('library results never replace the pending or restored playback track', () => {
  const context = vm.createContext({ computed, ref });
  vm.runInContext(code, context);
  const visibleTracks = ref([{ id: 1, path: '/first.mp3', title: 'First' }]);
  const state = context.useActiveTrackState({ currentSource: computed(() => ''), isRemoteTrack: () => false, visibleTracks });
  assert.equal(state.activeTrack.value, null);
  visibleTracks.value = [{ id: 2, path: '/search.mp3', title: 'Search' }];
  assert.equal(state.activeTrack.value, null);
  const restored = { id: 3, path: '/saved.mp3', title: 'Saved' };
  state.selectedTrack.value = restored;
  assert.equal(state.activeTrack.value.id, 3);
  state.currentPlaybackTrack.value = restored;
  visibleTracks.value = [];
  assert.equal(state.activeTrack.value.id, 3);
  state.currentPlaybackTrack.value = { id: 4, path: '/playing.mp3', title: 'Playing' };
  assert.equal(state.activeTrack.value.id, 4);
});
