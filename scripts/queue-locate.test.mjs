import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/composables/useQueuePopover.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

test('locate scrolls the shared queue and ignores unmounted rows', async () => {
  class Row {
    isConnected = true;
    calls = [];
    getClientRects() { return [{}]; }
    getBoundingClientRect() { return { top: 500, height: 48 }; }
    closest() {
      return {
        scrollTop: 0, clientHeight: 390, scrollHeight: 1000,
        getBoundingClientRect: () => ({ top: 100 }),
        scrollTo: options => this.calls.push(options.top),
      };
    }
  }
  const context = vm.createContext({
    HTMLElement: Row, ref: value => ({ value }), watch() {}, onBeforeUnmount() {},
    nextTick: async () => {}, queueMicrotask,
  });
  vm.runInContext(code, context);
  const queue = vm.runInContext('useQueuePopover({ activeTrack: { value: { id: 1 } }, onPlayTrack() {} })', context);
  const lyricsQueue = new Row();
  const removedQueue = new Row();
  removedQueue.isConnected = false;
  for (const row of [removedQueue, lyricsQueue]) queue.setQueueTrackElement(1, row);
  await queue.locateQueueTrack();
  assert.deepEqual(lyricsQueue.calls, [229]);
  assert.deepEqual(removedQueue.calls, []);
});

test('both playback bars share a single application-level queue panel', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const dock = read('../src/components/PlayerDock.vue');
  const button = read('../src/components/player-dock/PlaybackQueuePopover.vue');
  const meta = read('../src/components/player-dock/PlaybackMetaControls.vue');
  assert.equal((dock.match(/<PlaybackQueuePanel\b/g) ?? []).length, 1);
  assert.match(dock, /<Teleport to="\.mono-window">/);
  assert.doesNotMatch(button, /PlaybackQueueList|PlaybackQueueHeader|class="queue-popover"/);
  assert.doesNotMatch(meta, /<PlaybackQueuePanel\b/);
});
