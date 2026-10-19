import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

async function harness() {
  const context = vm.createContext({ songloft: { log: { warn() {} } } });
  for (const path of ['plugins/miot/src/player/device_display.ts', 'plugins/miot/src/handlers/playlist.ts']) {
    const source = readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
    const { code } = await transform(source, { loader: 'ts' });
    vm.runInContext(code, context);
  }
  return context;
}
const local = () => ({ state: 'playing', is_playing: true, current_song: { id: 1, title: 'Old', artist: 'Singer' }, position: 40, duration: 100, speed: 2, playlist_id: 2, current_index: 0 });

for (const title of ['New song', undefined]) {
  test(`native playback never inherits the old song or seek offset (title=${title})`, async () => {
    const context = await harness();
    let calibrations = 0;
    const manager = { getStatus: local, getStreamSeekOffsetSec: () => 20, getPlaybackSpeed: () => 2,
      matchDeviceStream: () => 'foreign', isVoiceSuspended: () => true,
      resetAutoNextTimer: () => { calibrations++; }, getPosition: () => 40 };
    const map = { getOrCreate: async () => manager };
    let requests = 0;
    const service = { getPlayerStatus: async () => { requests++; return { data: { info: JSON.stringify({ status: 1, volume: 30, play_song_detail: { title, position: 12000, duration: 200000 } }) } }; } };
    const first = await context.resolvePlayerStatus(map, service, 'a', 'd');
    assert.equal(first.current_song, null);
    assert.equal(first.external_media.title, title || '音箱正在播放');
    assert.equal(first.position, 12);
    assert.equal(first.duration, 200);
    assert.equal(first.speed, 1);
    assert.equal(first.is_playing, true);
    const cached = await context.resolvePlayerStatus(map, service, 'a', 'd');
    assert.equal(cached.current_song, null);
    assert.equal(requests, 1);
    assert.equal(calibrations, 0);
  });
}

test('paused Mono playback without stream duration remains local', async () => {
  const context = await harness();
  assert.equal(context.externalPlaybackStatus({ ...local(), state: 'paused' },
    { state: 'paused', position: 3, duration: 0, volume: 20 }, 'unknown', false), null);
});

test('voice queue changes during a device request discard old song and progress', async () => {
  const context = await harness();
  let status = local(), release;
  const manager = { getStatus: () => status, getStreamSeekOffsetSec: () => 0, getPlaybackSpeed: () => 1 };
  const service = { getPlayerStatus: () => new Promise(resolve => { release = resolve; }) };
  const pending = context.resolvePlayerStatus({ getOrCreate: async () => manager }, service, 'a', 'd');
  await new Promise(setImmediate);
  status = { ...local(), current_song: { id: 2, title: 'New' }, position: 0 };
  release({ data: { info: JSON.stringify({ status: 1, play_song_detail: { position: 90000, duration: 100000 } }) } });
  const result = await pending;
  assert.equal(result.current_song.id, 2);
  assert.equal(result.position, 0);
  assert.equal(context.getDeviceStatusCache('a', 'd'), undefined);
});
