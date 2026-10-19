import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';
const source = readFileSync(new URL('../src/services/desktopPlaybackCard.ts', import.meta.url), 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });
test('card style persists without dropping other settings and overrides stale opening config', async () => {
  let saved = { extra: true }, windowOptions;
  const updates = [];
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
    emitTo: async (label, event, payload) => { updates.push({ label, event, payload }); },
  });
  vm.runInContext(code, context);
  await vm.runInContext("Promise.all([saveDesktopCardStyle('ink'), saveDesktopCardStyle('guofeng')])", context);
  assert.equal(saved.cardStyle, 'guofeng');
  assert.equal(saved.extra, true);
  await vm.runInContext("openDesktopPlaybackCard('renderer.mjs', 'manifest.json', { cardStyle: 'minimal' })", context);
  assert.equal(new URLSearchParams(windowOptions.url.split('?')[1]).get('cardStyle'), 'guofeng');
  await vm.runInContext("saveDesktopCardStyle('ancient')", context);
  assert.equal(saved.cardStyle, 'ancient');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].label, 'desktop-playback-card');
  assert.equal(updates[0].event, 'desktop-card://config');
  assert.equal(updates[0].payload.cardStyle, 'ancient');
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

test('built-in card opens without an installed manifest', async () => {
  let options;
  class Window {
    static async getByLabel() { return null; }
    constructor(_label, value) { options = value; }
    async once(event, callback) { if (event === 'tauri://created') callback(); }
    async show() {}
  }
  const context = vm.createContext({ isTauriRuntime:()=>true, WebviewWindow:Window, URLSearchParams,
    getPluginConfig:async()=>({cardStyle:'ancient'}), currentMonitor:async()=>null, primaryMonitor:async()=>null });
  vm.runInContext(code, context);
  await vm.runInContext("openDesktopPlaybackCard('builtin:playback-card')", context);
  const query = new URLSearchParams(options.url.split('?')[1]);
  assert.equal(query.get('entry'), 'builtin:playback-card');
  assert.equal(query.get('manifestPath'), '');
  assert.equal(query.get('cardStyle'), 'ancient');
});

test('switching from built-in card to a custom desktop renderer replaces the window and loads its own config', async () => {
  let closed = 0, options, configId;
  class Window {
    static async getByLabel() { return {close:async()=>{closed++;}}; }
    constructor(_label, value) { options = value; }
    async once(event, callback) { if (event === 'tauri://created') callback(); }
    async show() {}
  }
  const context = vm.createContext({ isTauriRuntime:()=>true, WebviewWindow:Window, URLSearchParams,
    getPluginConfig:async(id)=>{configId=id;return {};}, currentMonitor:async()=>null, primaryMonitor:async()=>null });
  vm.runInContext(code, context);
  await vm.runInContext("openDesktopPlaybackCard('custom.mjs','manifest.json',{},'my-desktop')", context);
  assert.equal(closed, 1);
  assert.equal(configId, 'my-desktop');
  assert.equal(new URLSearchParams(options.url.split('?')[1]).get('rendererId'), 'my-desktop');
});
