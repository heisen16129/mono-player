import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/services/pluginApiTransport.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const { code } = await transform(source, { loader: 'ts' });

function setup(open = Promise.resolve('private-session')) {
  const calls = [], messages = [], channels = [];
  const listeners = new Map();
  class Port {
    closed = false;
    start() {}
    close() { this.closed = true; }
    postMessage(message) { messages.push(message); }
  }
  const frame = {
    hasAttribute: () => true,
    sandbox: { contains: token => token === 'allow-scripts' },
    contentWindow: { postMessage: (...args) => messages.push(args) },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
  };
  const context = vm.createContext({
    MessageChannel: class { constructor() { this.port1 = new Port(); this.port2 = new Port(); channels.push(this); } },
    invoke: async (method, params) => {
      calls.push({ method, params });
      if (method === 'plugin_api_open') return open;
      if (method === 'plugin_api_request') return { requestId: params.request.requestId, ok: true, data: {} };
    },
  });
  vm.runInContext(code, context);
  return { frame, calls, messages, channels, listeners, connect: () => context.connectPluginPage(frame, 'one', 'main', 'loaded-revision') };
}

test('plugin receives a dedicated port, never its session token', async () => {
  const state = setup();
  const dispose = await state.connect();
  assert.equal(state.calls[0].params.revision, 'loaded-revision');
  assert.equal(state.messages[0][0].type, 'mono:connect');
  assert.equal(JSON.stringify(state.messages[0]).includes('private-session'), false);
  await state.channels[0].port1.onmessage({ data: { apiVersion: 1, requestId: 'one', method: 'library.listTracks', params: {} } });
  assert.equal(state.calls[1].params.sessionId, 'private-session');
  dispose();
  dispose();
  assert.equal(state.calls.filter(c => c.method === 'plugin_api_close').length, 1);
  assert.equal(state.channels[0].port1.closed, true);
});

test('navigation during session creation closes it without transferring a port', async () => {
  let resolve;
  const state = setup(new Promise(r => { resolve = r; }));
  const connection = state.connect();
  state.listeners.get('load')();
  resolve('private-session');
  await connection;
  assert.equal(state.messages.length, 0);
  assert.equal(state.calls.at(-1).method, 'plugin_api_close');
});

test('same-origin frames are rejected before creating a session', async () => {
  const state = setup();
  state.frame.sandbox.contains = () => true;
  await assert.rejects(state.connect(), /隔离沙箱/);
  assert.equal(state.calls.length, 0);
});

test('invalid protocol requests do not reach native dispatch', async () => {
  const state = setup();
  const dispose = await state.connect();
  await state.channels[0].port1.onmessage({ data: { apiVersion: 0, requestId: 'one', method: 'player.pause', params: {} } });
  assert.equal(state.calls.length, 1);
  dispose();
});
