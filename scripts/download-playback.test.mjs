import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

async function setup() {
  const context = vm.createContext({ normalizePath: p => p, positiveStableStringHash: s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0), isRemoteTrack: () => true });
  for (const file of ['src/utils/downloadedTrack.ts', 'src/composables/useDownloadedTrackActions.ts']) {
    const source = readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
    const { code } = await transform(source, { loader: 'ts' });
    vm.runInContext(code, context);
  }
  return context;
}
const item = (id, status) => ({ id, status, title: id, artist: [], album: null, duration: 10, sourceName: 'provider', sourceId: id, filePath: 'partial.mp3', downloadRequest: { track: { id: 1, path: 'https://expired/song', sourceProviderId: 'provider', sourceId: id, sourceRaw: { token: id } } } });

test('unfinished downloads have no playable source, completed downloads use local file', async () => {
  const c = await setup();
  for (const status of ['downloading', 'paused', 'failed']) {
    const track = c.createDownloadTrack(item('song/1', status));
    assert.equal(track.path, '');
    assert.equal(track.sourceProviderId, undefined);
  }
  const completed = c.createDownloadTrack(item('song', 'downloaded'));
  assert.equal(completed.path, 'partial.mp3');
  assert.equal(completed.sourceProviderId, undefined);
});

test('pending song does not start playback or change queue, completed song plays', async () => {
  const c = await setup();
  const items = [item('a', 'downloaded'), item('b', 'downloading'), item('c', 'paused')];
  const calls = [];
  const queue = { value: [] };
  const actions = c.useDownloadedTrackActions({ downloadItems: { value: items }, rustPlaybackQueue: queue, startRustPlaybackQueue: async (...args) => { calls.push(args); return true; } });
  for (const status of ['downloading', 'paused', 'failed']) {
    const pending = item('b', status);
    items[1] = pending;
    await actions.playDownloadedTrack({ ...c.createDownloadTrack(pending), path: 'plugin://provider/b' });
  }
  assert.equal(calls.length, 0);
  assert.equal(queue.value.length, 0);
  await actions.playDownloadedTrack(c.createDownloadTrack(items[0]));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].length, 1);
  assert.equal(calls[0][0][0].path, 'partial.mp3');
});
