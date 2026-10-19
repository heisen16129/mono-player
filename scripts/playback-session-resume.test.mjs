import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/composables/usePlayerDockRuntime.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'dock-host', setup(builder) {
    builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      export const ref = value => ({ value });
      export const computed = getter => ({ get value() { return getter(); } });
      export function watch() {}
      export function onBeforeUnmount() {}
    ` }));
    builder.onLoad({ filter: /stores[\\/]player\.ts$/ }, () => ({ contents: `
      export const usePlayerStore = () => ({ settings: { fadePlayback: false } });
    ` }));
    builder.onLoad({ filter: /useRustPlaybackListeners\.ts$/ }, () => ({ contents: 'export function useRustPlaybackListeners() {}' }));
    builder.onLoad({ filter: /services[\\/]playerBackend\.ts$/ }, () => ({ contents: `
      export async function resumeRustBackend() { return globalThis.dockBackend.resume(); }
      export async function pauseRustBackend() {}
      export async function setRustBackendOutputDevice() {}
      export async function setRustBackendSpeed() {}
      export async function setRustBackendVolume() {}
      export async function stopRustBackend() {}
    ` }));
  } }],
});
const { usePlayerDockRuntime } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

function setup(backendActive, resume = async () => {}) {
  globalThis.dockBackend = { resume };
  const requests = [];
  const currentTime = { value: 36 };
  const noop = () => {};
  const runtime = usePlayerDockRuntime({
    activeTrack: { value: { id: 1, path: 'D:/Music/song.mp3' } },
    canControlPlayback: { value: true }, isPlaying: { value: false },
    isPreparingActiveTrack: { value: false }, playbackRate: { value: 1 },
    progress: { currentTime, setPlaybackTime: noop, startSmoothProgress: noop,
      stopSmoothProgress: noop, syncPlaybackTimeFromRust: noop, syncSmoothProgressBase: noop },
    queue: { value: [] }, restoreRequestId: { value: 1 }, restoreTime: { value: 36 },
    rustBackendActive: { value: backendActive }, togglePlaybackRequestId: { value: 0 },
    onOutputDeviceFallback: noop, onClearPlaybackError: noop, onPlaybackError: error => { throw error; },
    onPlaybackNotice: noop, onPlaybackStateChange: noop,
    onRequestInitialPlayback: time => requests.push(time), onSeamlessAdvance: noop,
  });
  return { runtime, requests, currentTime };
}

test('restored queue uses the backend resume command', async () => {
  let resumed = 0;
  const { runtime, requests } = setup(false, async () => { resumed++; });
  await runtime.togglePlayback();
  assert.equal(resumed, 1);
  assert.deepEqual(requests, []);
});

test('resume errors are reported instead of restarting playback in the frontend', async () => {
  const { runtime, requests } = setup(true, async () => { throw new Error('No active audio to resume.'); });
  await assert.rejects(runtime.togglePlayback(), /No active audio to resume/);
  assert.deepEqual(requests, []);
});

test('ordinary paused audio uses the same resume command', async () => {
  let resumed = 0;
  const { runtime, requests } = setup(true, async () => { resumed++; });
  await runtime.togglePlayback();
  assert.equal(resumed, 1);
  assert.deepEqual(requests, []);
});
