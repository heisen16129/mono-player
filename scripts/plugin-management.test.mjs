import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/services/plugins.ts', 'utf8')
  .replace(/^import[\s\S]*?from [^;]+;\r?\n/gm, '')
  .replace(/export /g, '');
const { code } = await transform(source, { loader: 'ts' });

test('batch installs await the shared permission flow and report per-item failure', async()=>{
  const installed=[],progress=[],actions=[];
  const context=vm.createContext({
    requestPackageInstall:async path=>{installed.push(path);if(path==='bad.monoplugin.zip')throw new Error('invalid package');},
    invokeApi:async(command,{request})=>{assert.equal(command,'plugin_action');actions.push(request.id);},
  });
  vm.runInContext(code,context);
  const results=await context.batchPluginActions([
    {action:'install',id:'a',filePath:'a.monoplugin.zip'},
    {action:'update',id:'b',item:{entry:'bad.monoplugin.zip'}},
    {action:'enabled',id:'c',enabled:false},
  ],(done,total)=>progress.push([done,total]));
  assert.deepEqual(installed,['a.monoplugin.zip','bad.monoplugin.zip']);
  assert.deepEqual(actions,['c']);
  assert.deepEqual(Array.from(results,r=>r.success),[true,false,true]);
  assert.match(results[1].error,/invalid package/);
  assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);
});
test('empty batch performs no install or host calls', async()=>{
  const context=vm.createContext({invokeApi:()=>assert.fail('unexpected request'),requestPackageInstall:()=>assert.fail('unexpected install')});
  vm.runInContext(code,context);
  assert.equal((await context.batchPluginActions([])).length,0);
});

const dialogSource = readFileSync('src/components/plugin-manager/PluginPackagePanel.vue', 'utf8')
  .split('<script setup lang="ts">')[1].split('</script>')[0]
  .replace(/^import[\s\S]*?from [^;]+;\r?\n/gm, '');
const dialogCode = (await transform(dialogSource, { loader: 'ts' })).code;
function createInstaller(open, installPluginPackage) {
  const events = [];
  let exposed;
  const context = vm.createContext({
    ref: value => ({ value }), onBeforeUnmount() {}, open,
    defineEmits: () => (...args) => events.push(args),
    defineExpose: value => { exposed = value; },
    inspectPluginPackage: async path => ({ revision: 'revision', manifest: { name: 'Example', permissions: ['player.read'] } }),
    installPluginPackage,
    PLUGINS_CHANGED_EVENT: 'plugins-changed',
    window: { dispatchEvent() {} }, CustomEvent: class {},
  });
  vm.runInContext(dialogCode, context);
  return { context, events, get exposed() { return exposed; } };
}

test('local import selects a zip package and installs only after permission confirmation', async () => {
  const installs = [];
  const installer = createInstaller(async options => {
    assert.deepEqual(Array.from(options.filters[0].extensions), ['zip']);
    return 'aq-lyrics/mono-wasm-aq-lyrics.monoplugin.zip';
  }, async (...args) => installs.push(args));
  await installer.exposed.importPackage();
  assert.equal(installs.length, 0);
  await installer.context.install();
  assert.equal(installs.length, 1);
  assert.equal(installs[0][0], 'aq-lyrics/mono-wasm-aq-lyrics.monoplugin.zip');
  assert.equal(installs[0][1], 'revision');
  assert.deepEqual(Array.from(installs[0][2]), ['player.read']);
  assert.ok(installer.events.some(([name]) => name === 'installed'));
});

test('canceling file selection does not install or refresh the installed list', async () => {
  const installer = createInstaller(async () => null, () => assert.fail('unexpected install'));
  await installer.exposed.importPackage();
  await installer.context.install();
  assert.equal(installer.events.length, 0);
});

const rowsSource = readFileSync('src/composables/usePluginRows.ts', 'utf8')
  .replace(/^import[\s\S]*?from [^;]+;\r?\n/gm, '').replace(/export /g, '');
const rowsCode = (await transform(rowsSource, { loader: 'ts' })).code;

test('installed rows exclude catalog-only plugins and retain installed plugin metadata', () => {
  const context = vm.createContext({ computed: getter => ({ get value() { return getter(); } }) });
  vm.runInContext(rowsCode, context);
  const catalogPlugins = { value: [{ id: 'catalog-only', name: 'Available' }, { id: 'installed', version: '2.0' }] };
  const installedPlugins = { value: [] };
  const rows = context.usePluginRows({ catalogPlugins, installedPlugins, deletedPluginIds: { value: new Set() } });
  assert.equal(rows.visiblePlugins.value.length, 0);
  installedPlugins.value = [{ id: 'installed', name: 'Installed', enabled: true, capabilities: [] }];
  assert.deepEqual(Array.from(rows.visiblePlugins.value, row => row.id), ['installed']);
  assert.equal(rows.visiblePlugins.value[0].installed, true);
  assert.equal(rows.visiblePlugins.value[0].catalogItem.version, '2.0');
  installedPlugins.value = [];
  assert.equal(rows.visiblePlugins.value.length, 0);
});
