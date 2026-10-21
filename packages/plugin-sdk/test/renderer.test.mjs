import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('packages/plugin-sdk/src/renderer.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const { code } = await transform(source, { loader: 'ts' });
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(renderer) {
  const window = new EventTarget();
  const posted = [];
  window.parent = { postMessage: message => posted.push(message) };
  let disconnected = 0;
  const context = vm.createContext({ window, AbortController,
    connectToHost: async () => ({ dispose: () => disconnected++ }) });
  vm.runInContext(code, context);
  const root = { setAttribute() {} };
  return {
    mount: () => context.mountRenderer(renderer, root), posted, disconnected: () => disconnected,
    hide: () => window.dispatchEvent(new Event('pagehide')),
    send(message, source = window.parent) {
      const event = new Event('message');
      Object.assign(event, { source, data: { type: 'mono:renderer-update', apiVersion: 1, message } });
      window.dispatchEvent(event);
    },
  };
}

test('updates wait for mount, ignore foreign windows and stale lyrics, and stop on disposal', async () => {
  let finish;
  const messages = [];
  let destroyed = 0;
  const state = setup({ mount: () => new Promise(resolve => { finish = resolve; }),
    update: async message => { await tick(); messages.push(message.type); }, destroy: () => destroyed++ });
  const ready = state.mount();
  state.send({ type: 'lyrics', trackKey: 'old' });
  state.send({ type: 'track', trackKey: 'current' });
  state.send({ type: 'playback' }, {});
  await tick();
  assert.deepEqual(messages, []);
  finish();
  const dispose = await ready;
  state.send({ type: 'lyrics', trackKey: 'current' });
  await tick(); await tick(); await tick();
  assert.deepEqual(messages, ['track', 'lyrics']);
  assert.equal(state.posted.length, 1);
  dispose(); dispose();
  state.send({ type: 'playback' });
  await tick();
  assert.deepEqual(messages, ['track', 'lyrics']);
  assert.equal(destroyed, 1);
  assert.equal(state.disconnected(), 1);
});

test('closing during asynchronous mount cleans resources once after mount settles', async () => {
  let finish;
  let destroyed = 0;
  const state = setup({ mount: () => new Promise(resolve => { finish = resolve; }),
    update() { assert.fail('closed renderer received updates'); }, destroy: () => destroyed++ });
  const ready = state.mount();
  await tick();
  state.hide();
  assert.equal(destroyed, 0);
  assert.equal(state.disconnected(), 1);
  finish();
  (await ready)();
  assert.equal(destroyed, 1);
  assert.equal(state.posted.length, 0);
});

test('failed mount disposes partial renderer resources', async () => {
  let destroyed = 0;
  const state = setup({ mount: async () => { throw new Error('mount failed'); }, update() {}, destroy: () => destroyed++ });
  await assert.rejects(state.mount(), /mount failed/);
  assert.equal(destroyed, 1);
  assert.equal(state.disconnected(), 1);
  assert.equal(state.posted.length, 0);
});
