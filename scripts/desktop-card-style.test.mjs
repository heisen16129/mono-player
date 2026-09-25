import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';
const source = readFileSync(new URL('../src/services/desktopPlaybackCard.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });
test('card style persists without dropping other settings and overrides stale opening config', async () => {
  let saved = { extra: true }, windowOptions;
  class CardWindow {
    static async getByLabel() { return null; }
    constructor(_label, options) { windowOptions = options; }
    async once(event, callback) { if (event === 'tauri://created') callback(); }
    async show() {}
  }
  const context = vm.createContext({
    getPluginConfig: async () => ({ ...saved }),
    savePluginConfig: async (_id, value) => { saved = value; },
    isTauriRuntime: () => true,
    WebviewWindow: CardWindow, URLSearchParams,
    currentMonitor: async () => null, primaryMonitor: async () => null,
  });
  vm.runInContext(code, context);
  await vm.runInContext("Promise.all([saveDesktopCardStyle('ink'), saveDesktopCardStyle('guofeng')])", context);
  assert.equal(saved.cardStyle, 'guofeng');
  assert.equal(saved.extra, true);
  await vm.runInContext("openDesktopPlaybackCard('renderer.mjs', 'manifest.json', { cardStyle: 'minimal' })", context);
  assert.equal(new URLSearchParams(windowOptions.url.split('?')[1]).get('cardStyle'), 'guofeng');
});

for (const visible of [true, false]) {
  test(`existing card is reused without config reset (visible=${visible})`, async () => {
    let shown = 0;
    const existing = { isVisible: async () => visible, show: async () => { shown++; }, once: async () => {} };
    const context = vm.createContext({
      isTauriRuntime: () => true,
      WebviewWindow: { getByLabel: async () => existing },
      getPluginConfig: () => { throw new Error('must not reload config'); },
      emitTo: () => { throw new Error('must not reset card'); },
    });
    vm.runInContext(code, context);
    await vm.runInContext("openDesktopPlaybackCard('renderer.mjs', 'manifest.json')", context);
    assert.equal(shown, visible ? 0 : 1);
  });
}
