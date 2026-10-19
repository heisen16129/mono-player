import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const compile = async path => (await transform(readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, ''), { loader: 'ts' })).code;
const queueCode = await compile('src/composables/useRustQueueSnapshotController.ts');
const downloadCode = await compile('src/composables/useDownloadState.ts');

test('backend removal clears active track even when the queue retains other songs', () => {
  const current = { id: 1, path: 'C:/removed.mp3' };
  const remaining = { id: 2, path: 'C:/kept.mp3' };
  const ref = value => ({ value });
  const player = { currentTrack: current, queue: [current], playbackMode: 'repeat', setCurrentTrack(track) { this.currentTrack = track; } };
  const currentPlaybackTrack = ref(current), rustPlaybackQueue = ref([current]);
  const context = vm.createContext({ mergeTrackRuntimeMetadata: track => track });
  vm.runInContext(queueCode, context);
  const controller = context.useRustQueueSnapshotController({
    player, currentPlaybackTrack, rustPlaybackQueue,
    selectedTrack: ref(current), onlineActiveTrack: ref(null), onlineActivePluginTrack: ref(null),
    onlineActiveTrackKey: ref(null), onlinePlaybackSource: ref(''), playbackTime: ref(30), isAudioPlaying: ref(true),
    syncLyricsViewStateForTrack() {},
  });
  controller.handleRustQueueSnapshot({ tracks: [remaining], sources: [remaining.path], currentSource: null, currentIndex: null, playbackMode: 'shuffle' });
  assert.equal(currentPlaybackTrack.value, null);
  assert.equal(player.currentTrack, null);
  assert.equal(player.queue[0], remaining);
  assert.equal(rustPlaybackQueue.value[0], remaining);
  assert.equal(player.playbackMode, 'shuffle');
});

test('download lists and badges apply the same backend snapshot', async () => {
  const snapshot = { downloaded: [{ id: 'done', status: 'downloaded' }], downloading: [{ id: 'paused', status: 'paused' }, { id: 'failed', status: 'failed' }], downloadedKeys: ['done'], pendingKeys: ['paused'] };
  const context = vm.createContext({ ref: value => ({ value }), downloadRecordsSnapshot: async () => snapshot });
  vm.runInContext(downloadCode, context);
  const state = context.useDownloadState();
  await state.loadDownloadItems();
  assert.deepEqual(state.downloadedTrackKeys.value, ['done']);
  assert.deepEqual(state.pendingDownloadTrackKeys.value, ['paused']);
  assert.equal(state.downloadItems.value.length, 3);
});
