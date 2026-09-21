import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/composables/useAppBootstrap.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'bootstrap-host', setup(builder) {
    builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export function onMounted() {}' }));
    builder.onLoad({ filter: /services[\\/]startup\.ts$/ }, () => ({ contents: 'export function traceStartup() {}' }));
    builder.onLoad({ filter: /services[\\/]playerBackend\.ts$/ }, () => ({ contents: `
      export async function getRustBackendDefaultCacheDir() { return 'cache'; }
      export async function setRustBackendCacheDir() {}
    ` }));
  } }],
});
const { useAppBootstrap } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

for (const userStartedPlayback of [false, true]) {
  test(`shell appears before slow library and queue restoration (new playback: ${userStartedPlayback})`, async () => {
    let releaseLibrary;
    let libraryStarted;
    const started = new Promise(resolve => { libraryStarted = resolve; });
    const library = new Promise(resolve => { releaseLibrary = resolve; });
    const ready = { value: false };
    let restored = false;
    let listenerReady = false;
    const noop = async () => {};
    const player = {
      settings: { audioCacheDir: 'cache' }, currentTrack: null, queue: [],
      hydratePersistedState: noop,
      async loadLibrary() { libraryStarted(); await library; },
    };
    const { initializeApp } = useAppBootstrap({
      player, isAppReady: ready, loadLibraryPanelWidth: noop, loadDownloadItems: noop,
      dedupePlaybackQueue: tracks => tracks, rustPlaybackQueue: { value: [] },
      startRustQueueEventListener: async () => { listenerReady = true; },
      restoreSavedPlaybackSession: () => ({ track: { id: 1 }, currentTime: 12 }),
      restoreRustPlaybackQueue: async () => { restored = true; },
      startDesktopLyricsActionListener: noop, startDesktopLyricsReadyListener: noop,
      startDownloadEventListener: noop,
    });
    const pending = initializeApp();
    await started;
    assert.equal(ready.value, true);
    assert.equal(listenerReady, true);
    assert.equal(restored, false);
    if (userStartedPlayback) player.currentTrack = { id: 2 };
    releaseLibrary();
    await pending;
    assert.equal(restored, !userStartedPlayback);
  });
}
