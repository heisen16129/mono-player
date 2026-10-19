import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, ref } from 'vue';

const identityCode = await transform(readFileSync('src/utils/favoriteIdentity.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });
const actionsCode = await transform(readFileSync('src/stores/player/favoriteActions.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });
const song = (id = 1, path = 'C:/Music/song.mp3') => ({ id, path, title: 'Song', artist: [], album: null, duration: 42 });

function setup() {
  let saved = [];
  let failure = false;
  const calls = [];
  const response = () => ({ items: saved, statistics: { count: saved.length, totalSeconds: 42 * saved.length } });
  const context = vm.createContext({
    computed, ref, getErrorMessage: error => error.message,
    isRemoteTrack: track => /^(plugin|https?):\/\//i.test(track.path),
    listFavorites: async () => response(),
    addFavorite: async track => {
      calls.push('add');
      if (failure) throw Error('write failed');
      saved = [{ id: 10, identityKey: context.favoriteIdentity(track), track }, ...saved];
      return response();
    },
    removeFavorite: async id => {
      calls.push('remove');
      if (failure) throw Error('write failed');
      saved = saved.filter(item => item.id !== id);
      return response();
    },
  });
  vm.runInContext(identityCode.code + actionsCode.code, context);
  const tracks = ref([]), error = ref(null);
  return { actions: context.createPlayerFavoriteActions({ error }), tracks, error, calls, setSaved: value => { saved = value; }, fail: value => { failure = value; } };
}

test('rapid toggles serialize; explicit additions remain idempotent', async () => {
  const { actions, calls } = setup();
  const first = actions.toggleFavorite(song());
  const second = actions.toggleFavorite(song());
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.deepEqual(calls, ['add', 'remove']);
  await Promise.all([actions.addFavoriteTrack(song()), actions.addFavoriteTrack(song())]);
  assert.deepEqual(calls, ['add', 'remove', 'add']);
  assert.equal(actions.favoriteTracks.value.length, 1);
});

test('failed writes retain state, report error, and allow later operations', async () => {
  const { actions, error, fail } = setup();
  fail(true);
  assert.equal(await actions.toggleFavorite(song()), undefined);
  assert.equal(actions.isFavorite(song()), false);
  assert.equal(error.value, 'write failed');
  fail(false);
  await actions.toggleFavorite(song());
  fail(true);
  await actions.toggleFavorite(song());
  assert.equal(actions.isFavorite(song()), true);
});

test('local rescan updates displayed metadata and IDs without losing favorite identity', async () => {
  const { actions, tracks, setSaved } = setup();
  await actions.addFavoriteTrack(song());
  tracks.value = [{ ...song(99, 'c:\\music\\SONG.mp3'), title: 'Updated' }];
  setSaved([{ id: 10, identityKey: '["local","c:/music/song.mp3"]', track: tracks.value[0] }]);
  await actions.reloadFavorites();
  assert.equal(actions.isFavorite(tracks.value[0]), true);
  assert.equal(actions.favoriteTracks.value[0].title, 'Updated');
  assert.equal(actions.favoriteTrackIds.value[0], 99);
  tracks.value = [];
  assert.equal(actions.favoriteTracks.value.length, 1);
});

test('provider identity prevents numeric ID collisions and survives URL refresh', async () => {
  const { actions } = setup();
  const first = { ...song(-1, 'https://a/old'), sourceProviderId: 'a', sourceId: '42' };
  await actions.addFavoriteTrack(first);
  assert.equal(actions.isFavorite({ ...first, id: -99, path: 'https://a/new' }), true);
  assert.equal(actions.isFavorite({ ...first, sourceProviderId: 'b' }), false);
});
