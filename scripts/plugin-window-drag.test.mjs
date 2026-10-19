import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync('src/composables/usePluginWindowDrag.ts', 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });

test('only the active integrated plugin frame can request window dragging', () => {
  let handler;
  let cleanup;
  let calls = 0;
  let enabled = true;
  const frameWindow = {};
  const context = vm.createContext({
    URL, console,
    onMounted: callback => callback(),
    onBeforeUnmount: callback => { cleanup = callback; },
    window: {
      addEventListener: (_, callback) => { handler = callback; },
      removeEventListener: (_, callback) => { assert.equal(callback, handler); handler = null; },
    },
    isTauriRuntime: () => true,
    getCurrentWindow: () => ({ startDragging: async () => { calls++; } }),
  });
  vm.runInContext(code, context);
  const setup = vm.runInContext('usePluginWindowDrag', context);
  setup({ value: { contentWindow: frameWindow } }, { value: 'http://127.0.0.1:1234/?monoSidebar=1' }, () => enabled);
  const event = { source: frameWindow, origin: 'http://127.0.0.1:1234', data: { type: 'mono:window-drag' } };
  handler({ ...event, source: {} });
  handler({ ...event, origin: 'https://example.com' });
  handler({ ...event, data: { type: 'other' } });
  assert.equal(calls, 0);
  handler(event);
  assert.equal(calls, 1);
  enabled = false;
  handler(event);
  assert.equal(calls, 1);
  cleanup();
  assert.equal(handler, null);
});
