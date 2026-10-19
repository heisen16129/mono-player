import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const compile = async path => (await transform(readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, ''), { loader: 'ts' })).code;
const localCode = await compile('src/composables/useLocalLyricsLoader.ts');
const onlineCode = await compile('src/composables/useOnlineLyricsLoader.ts');
const stale = { lyrics: [{ format: 'lrc', content: 'old' }] };
const fresh = { lyrics: [{ format: 'lrc', content: 'new' }] };

test('local replay fetches fresh lyrics and clears removed lyrics', async () => {
  const track = { id: 1, path: 'a.flac', lyrics: stale };
  const activeTrack = { value: track };
  let response = fresh, calls = 0;
  const applied = [];
  const context = vm.createContext({
    computed: fn => ({ get value() { return fn(); } }), watch() {},
    normalizePath: path => path, normalizeTrackLyrics: track => track?.lyrics,
    resolveLocalTrackLyrics: async () => { calls++; return response; }, console,
  });
  vm.runInContext(localCode, context);
  const loader = context.useLocalLyricsLoader({ activeTrack, onlineActiveTrack: { value: null },
    isRemoteTrack: () => false, applyLocalTrackLyrics: (_, lyrics) => applied.push(lyrics), updateLyricsViewStateForRequest() {},
  });
  await loader.loadLocalTrackLyricsInBackground(track);
  assert.equal(applied.at(-1), fresh);
  response = null;
  await loader.loadLocalTrackLyricsInBackground(track);
  assert.equal(calls, 2);
  assert.equal(applied.at(-1), null);
});

test('online replay rejects an earlier request even after switching back to the same song', async () => {
  let invalidate;
  const pending = [], applied = [];
  const activeTrack = { value: { id: 1, path: 'plugin://a', lyrics: stale } };
  const context = vm.createContext({ watch: (_, callback) => { invalidate = callback; },
    getPluginLyricsMetadata: () => new Promise(resolve => pending.push(resolve)),
    isPlaybackRequestReplacedError: () => false, isRemoteTrack: () => true, console,
  });
  vm.runInContext(onlineCode, context);
  const loader = context.useOnlineLyricsLoader({ activeTrack, onlineActiveTrackKey: { value: 'a' },
    getOnlineTrackKey: () => 'a', loadLocalTrackLyricsInBackground() {},
    updateActiveTrackSourceLyrics: lyrics => applied.push(lyrics), updateLyricsViewStateForRequest() {},
  });
  const track = { id: 'a', providerId: 'p', providerName: 'P' };
  const first = loader.loadOnlineTrackLyricsInBackground(track, activeTrack.value);
  invalidate();
  const replay = loader.loadOnlineTrackLyricsInBackground(track, activeTrack.value);
  pending[1](fresh); await replay;
  pending[0](stale); await first;
  assert.equal(applied.at(-1), fresh);
  const empty = loader.loadOnlineTrackLyricsInBackground(track, activeTrack.value);
  pending[2]({ lyrics: [] }); await empty;
  assert.equal(applied.at(-1).lyrics.length, 0);
});
