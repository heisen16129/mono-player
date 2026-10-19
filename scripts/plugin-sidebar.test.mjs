import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync('src/services/pluginPages.ts', 'utf8');
const { code } = await transform(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), { loader: 'ts' });
const calls = [];
const context = vm.createContext({ URL, invokeApi: async command => { calls.push(command); return 'http://127.0.0.1:1234'; } });
vm.runInContext(code, context);
const valid = vm.runInContext('hasPluginSidebarPage', context);
const resolve = vm.runInContext('resolvePluginPage', context);
const plugin = sidebar => ({ capabilities: ['speaker-control'], sidebar });

test('menu requires an explicit valid declaration', () => {
  for (const declaration of [null, {}, { icon: 'plug', page: { url: 'javascript:alert(1)' } }, { icon: 'plug', page: { action: 'arbitrary-command' } }, { icon: 'bad', page: { url: 'https://example.com' } }]) {
    assert.equal(valid(plugin(declaration)), false);
  }
  assert.equal(valid({ capabilities: [], sidebar: { icon: 'speaker', page: { action: 'speaker-control' } } }), false);
});

test('plugin-owned HTTPS page resolves without a host command', async () => {
  const count = calls.length;
  assert.equal(await resolve(plugin({ icon: 'plug', page: { url: 'https://example.com/plugin' } })), 'https://example.com/plugin');
  assert.equal(calls.length, count);
});

test('declared speaker page uses existing service', async () => {
  assert.equal(await resolve(plugin({ icon: 'speaker', page: { action: 'speaker-control' } })), 'http://127.0.0.1:1234/?monoSidebar=1');
  assert.equal(calls.at(-1), 'miot_open');
});

test('stem separation opens a native page without starting speaker service', async () => {
  const item = { capabilities: ['stem-separation'], sidebar: { icon: 'audio-lines', page: { action: 'stem-separation' } } };
  const count = calls.length;
  assert.equal(valid(item), true);
  assert.equal(await resolve(item), '');
  assert.equal(calls.length, count);
});
