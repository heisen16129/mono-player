import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, ref } from 'vue';

const compile = async path => (await transform(readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' })).code;
const code = await compile('src/utils/favoriteIdentity.ts') + await compile('src/stores/player/playlistActions.ts');
const local = { id: 1, path: 'C:/Music/song.mp3', title: 'Local' };
const online = { id: 1, path: 'plugin://a/42', title: 'Online', sourceProviderId: 'a', sourceId: '42', sourceRaw: { id: '42' } };

function setup() {
  let saved = [{ id: 'list', name: 'Mixed', tracks: [local, online], trackIds: [1, 1], createdAt: 1 }];
  let failure = false;
  const calls = [];
  const context = vm.createContext({
    ref, computed, getErrorMessage: error => error.message,
    isRemoteTrack: track => /^(plugin|https?):\/\//.test(track.path),
    service: {
      listPlaylists: async () => saved,
      renamePlaylist: async (id, name) => {
        calls.push(name);
        if (failure) throw Error('save failed');
        saved = saved.map(list => list.id === id ? { ...list, name } : list);
        return saved;
      },
      editPlaylistTracks: async (id, tracks, add) => {
        calls.push({ id, tracks, add });
        return saved;
      },
    },
  });
  vm.runInContext(code, context);
  const tracks = ref([local]), error = ref(null);
  return { actions: context.createPlayerPlaylistActions({ error }), tracks, error, calls, setSaved: value => { saved = value; }, fail: value => { failure = value; } };
}

test('mixed playlist retains source metadata and avoids local numeric ID collisions', async () => {
  const { actions, tracks, setSaved } = setup();
  await actions.reloadPlaylists();
  tracks.value = [{ ...local, id: 99, title: 'Updated local' }];
  setSaved([{ ...actions.playlists.value[0], tracks: [tracks.value[0], online], trackIds: [99, 1] }]);
  await actions.reloadPlaylists();
  assert.equal(actions.playlists.value[0].tracks[0].title, 'Updated local');
  assert.equal(actions.playlists.value[0].tracks[1].title, 'Online');
  assert.equal(actions.playlists.value[0].tracks[1].sourceRaw.id, '42');
  await actions.addTrackToPlaylist(online, 'list');
});

test('failed save retains the existing playlist; subsequent writes execute in order', async () => {
  const { actions, fail, error, calls } = setup();
  await actions.reloadPlaylists();
  fail(true);
  assert.equal(await actions.renamePlaylist('list', 'Failed'), false);
  assert.equal(actions.playlists.value[0].name, 'Mixed');
  assert.equal(error.value, 'save failed');
  fail(false);
  await Promise.all([actions.renamePlaylist('list', 'First'), actions.renamePlaylist('list', 'Last')]);
  assert.deepEqual(calls, ['Failed', 'First', 'Last']);
  assert.equal(actions.playlists.value[0].name, 'Last');
});

test('removing an online track passes its complete identity to the backend', async () => {
  const { actions, calls } = setup();
  await actions.removeTrackFromPlaylist(online, 'list');
  assert.equal(calls[0].add, false);
  assert.equal(calls[0].tracks[0].sourceProviderId, 'a');
  assert.equal(calls[0].tracks[0].sourceId, '42');
});
