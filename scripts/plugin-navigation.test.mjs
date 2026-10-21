import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const source = readFileSync('src/composables/usePluginNavigation.ts', 'utf8')
  .replace(/^import[\s\S]*?from [^;]+;\r?\n/gm, '').replace(/export /g, '');
const { code } = await transform(source, { loader: 'ts' });
function setup(service, presentation) {
  const watchers = [], calls = [], activeView = { value: 'library' };
  let enabled = true;
  const plugin = { id: 'example', enabled: true, packageRevision: 'revision', entry: service ? { service: 'dist/service.mjs' } : {},
    contributions: { pages: [{ id: 'main', title: 'Page', entry: 'ui/index.html', presentation }], sidebar: [], playbackBar: [] } };
  const context = vm.createContext({
    ref: value => ({ value }), computed: getter => ({ get value() { return getter(); } }),
    watch: (_, callback) => watchers.push(callback), onMounted() {}, onBeforeUnmount() {},
    listPluginPackages: async () => [plugin], invoke: (...args) => calls.push(args),
  });
  vm.runInContext(code, context);
  const navigation = context.createPluginNavigation(activeView, () => enabled, () => {}, () => {}, () => {});
  return { navigation, plugin, activeView, calls, disable() { enabled = false; watchers.forEach(callback => callback()); } };
}

test('declared dialog opens one dialog and leaves the underlying main page unchanged', async () => {
  const state = setup(true, 'dialog');
  await state.navigation.openPlugin('example', 'main');
  assert.equal(state.activeView.value, 'library');
  assert.equal(state.navigation.dialogPlugin.value.id, 'example');
  await state.navigation.openPlugin('example', 'main');
  assert.equal(state.navigation.dialogPage.value.id, 'main');
  state.navigation.closeDialog();
  assert.equal(state.navigation.dialogPlugin.value, null);
  assert.equal(state.activeView.value, 'library');
  assert.equal(state.calls.length, 0, 'closing the UI must not stop the service');
});

test('normal pages remain in the main view and explicit presentation overrides defaults', async () => {
  for (const service of [false, true]) {
    const state = setup(service, 'page');
    await state.navigation.openPlugin('example', 'main');
    assert.equal(state.activeView.value, 'plugin-page');
    assert.equal(state.navigation.activePage.value.id, 'main');
    assert.equal(state.navigation.dialogPlugin.value, null);
  }
});

test('explicit dialog pages work without a service and close when plugins are disabled', async () => {
  const state = setup(false, 'dialog');
  await state.navigation.openPlugin('example', 'main');
  assert.equal(state.navigation.dialogPlugin.value.id, 'example');
  state.disable();
  assert.equal(state.navigation.dialogPlugin.value, null);
});


test('sidebar and playback defaults are independent of backend runtime', async () => {
  for (const service of [false, true]) {
    const sidebar = setup(service);
    sidebar.plugin.contributions.sidebar = [{ id: 'open', pageId: 'main' }];
    await sidebar.navigation.openPlugin('example', 'main');
    assert.equal(sidebar.activeView.value, 'plugin-page');
    assert.equal(sidebar.navigation.dialogPlugin.value, null);
    const playback = setup(service);
    playback.plugin.contributions.playbackBar = [{ id: 'open', pageId: 'main' }];
    await playback.navigation.openPlugin('example', 'main');
    assert.equal(playback.activeView.value, 'library');
    assert.equal(playback.navigation.dialogPage.value.id, 'main');
  }
});

test('a page can override its launcher default', async () => {
  for (const [declared, launcherDefault] of [['page', 'dialog'], ['dialog', 'page']]) {
    const state = setup(false, declared);
    await state.navigation.launchPlugin(state.plugin, { pageId: 'main' }, launcherDefault);
    assert.equal(state.activeView.value, declared === 'page' ? 'plugin-page' : 'library');
    assert.equal(Boolean(state.navigation.dialogPlugin.value), declared === 'dialog');
  }
});

test('a page offered by both slots uses the clicked slot default', async () => {
  const state = setup(false);
  state.plugin.contributions.sidebar = [{ pageId: 'main' }];
  state.plugin.contributions.playbackBar = [{ pageId: 'main' }];
  await state.navigation.launchPlugin(state.plugin, { pageId: 'main' }, 'dialog');
  assert.equal(state.navigation.dialogPage.value.id, 'main');
  await state.navigation.launchPlugin(state.plugin, { pageId: 'main' }, 'page');
  assert.equal(state.navigation.dialogPlugin.value, null);
  assert.equal(state.activeView.value, 'plugin-page');
});
