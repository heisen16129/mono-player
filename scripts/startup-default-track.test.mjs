import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/stores/player.ts', 'utf8');
const start = source.indexOf('  function restorePlaybackSession()');
const end = source.indexOf('  async function loadLibrary()', start);
const restoreCode = source.slice(start, end);

for (const hasSession of [false, true]) {
  test(`startup selects first track only without a saved current track (session=${hasSession})`, () => {
    const first = { id: 1, path: '/first.mp3' };
    const saved = { id: 2, path: '/saved.mp3' };
    const context = vm.createContext({
      playbackSession: { value: hasSession ? { currentTrack: saved, queueTracks: [saved], currentTime: 36, playbackMode: 'repeat' } : null },
      tracks: { value: [first, saved] }, queue: { value: [] }, currentTrack: { value: null }, playbackMode: { value: 'shuffle' },
    });
    vm.runInContext(restoreCode, context);
    const result = context.restorePlaybackSession();
    assert.equal(result.track.id, hasSession ? 2 : 1);
    assert.equal(result.currentTime, hasSession ? 36 : 0);
    assert.equal(context.currentTrack.value.id, result.track.id);
    if (!hasSession) {
      context.tracks.value = [];
      assert.equal(context.restorePlaybackSession(), null);
    }
  });
}
