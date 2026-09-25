import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/composables/useLyricsEntry.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });
const manifest = { id: 'playback-card', enabled: true, kind: 'lyrics-renderer', runtime: 'module', sourceKind: 'local', sourceUrl: 'D:/cards/manifest.json', entry: 'D:/cards/renderer.mjs' };
function setup(id, list = async () => [manifest], open = async () => {}) {
  const calls = [], messages = [];
  const scope = {
    listInstalledPluginManifests: list,
    openDesktopPlaybackCard: async (...args) => { calls.push(args); await open(); },
    options: {
      renderer: { value: { id } }, config: { value: { cardStyle: 'ancient' } },
      toggleLyricsView: () => calls.push('lyrics-page'), notify: message => messages.push(message),
    },
  };
  vm.createContext(scope);
  vm.runInContext(code, scope);
  return { entry: vm.runInContext('useLyricsEntry(options)', scope), calls, messages };
}

test('cover click in card mode opens the desktop card with selected style, never the lyrics page', async () => {
  const state = setup('playback-card');
  await state.entry.openSelectedLyrics();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0][0], manifest.entry);
  assert.equal(state.calls[0][1], manifest.sourceUrl);
  assert.equal(state.calls[0][2].cardStyle, 'ancient');
});
test('other renderers continue opening the lyrics page', async () => {
  for (const id of ['classic', 'fanlyrics', 'betterlyrics']) {
    const state = setup(id, () => { throw new Error('must not load card'); });
    await state.entry.openSelectedLyrics();
    assert.deepEqual(state.calls, ['lyrics-page']);
  }
});
test('double clicks share one opening operation', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const state = setup('playback-card', async () => [manifest], () => pending);
  const first = state.entry.openSelectedLyrics();
  await state.entry.openSelectedLyrics();
  assert.equal(state.calls.length, 1);
  complete(); await first;
});
test('failed desktop opening reports an error without falling back to the lyrics page', async () => {
  const state = setup('playback-card', async () => []);
  await state.entry.openSelectedLyrics();
  assert.deepEqual(state.calls, []);
  assert.equal(state.messages.length, 1);
  await state.entry.openSelectedLyrics();
  assert.equal(state.messages.length, 2);
});
