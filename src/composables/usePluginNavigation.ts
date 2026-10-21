import { invoke } from '@tauri-apps/api/core';
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, watch, type InjectionKey, type Ref } from 'vue';
import type { InstalledPluginPackage, PluginPackageLauncher } from '../types/pluginPackage';
import type { AppView } from './useLibraryNavigation';
import { listPluginPackages } from '../services/pluginPackages';
import { PLUGINS_CHANGED_EVENT } from './useMusicSourcePluginAvailability';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { openPluginDesktop } from '../services/pluginDesktop';

function createPluginNavigation(activeView: Ref<AppView>, enabled: () => boolean, notify: (message:string) => void, openRenderer: (id:string) => void, showLyrics: () => void) {
  const installed = ref<InstalledPluginPackage[]>([]);
  const selectedId = ref<string | null>(null);
  const selectedPageId = ref<string | null>(null);
  const dialogId = ref<string | null>(null);
  const dialogPageId = ref<string | null>(null);
  const dialogPlugin = computed(() => plugins.value.find(plugin => plugin.id === dialogId.value) ?? null);
  const dialogPage = computed(() => dialogPlugin.value?.contributions.pages.find(page => page.id === dialogPageId.value) ?? null);
  function closeDialog() { dialogId.value = null; dialogPageId.value = null; }
  const settingsPluginId = ref<string | null>(null);
  const plugins = computed(() => enabled() ? installed.value.filter(plugin => plugin.enabled) : []);
  const sidebarEntries = computed(() => plugins.value.flatMap(plugin => plugin.contributions.sidebar.map(entry => ({ plugin, entry }))));
  const playbackEntries = computed(() => plugins.value.flatMap(plugin => plugin.contributions.playbackBar.map(entry => ({ plugin, entry }))));
  const activePlugin = computed(() => activeView.value === 'plugin-page'
    ? plugins.value.find(plugin => plugin.id === selectedId.value) ?? null : null);
  const activePage = computed(() => activePlugin.value?.contributions.pages.find(page => page.id === selectedPageId.value) ?? null);
  let generation = 0;
  let disposed = false;
  let unlisten: UnlistenFn | undefined;
  let unlistenUi: UnlistenFn | undefined;

  async function refresh() {
    const current = ++generation;
    const items = await listPluginPackages().catch(() => []);
    if (!disposed && current === generation) installed.value = items;
  }

  async function openPlugin(id: string, pageId: string, defaultPresentation?: 'page' | 'dialog') {
    await refresh();
    const plugin = plugins.value.find(plugin => plugin.id === id);
    const page = plugin?.contributions.pages.find(page => page.id === pageId);
    if (!plugin || !page) return;
    const presentation = page.presentation ?? defaultPresentation
      ?? (plugin.contributions.sidebar.some(entry => entry.pageId === pageId) ? 'page'
        : plugin.contributions.playbackBar.some(entry => entry.pageId === pageId) ? 'dialog' : 'page');
    if (presentation === 'dialog') {
      if (activePlugin.value?.id === id) activeView.value = 'library';
      dialogId.value = id;
      dialogPageId.value = pageId;
      return;
    }
    closeDialog();
    selectedId.value = id;
    selectedPageId.value = pageId;
    activeView.value = 'plugin-page';
  }

  async function launchPlugin(plugin: InstalledPluginPackage, entry: PluginPackageLauncher, defaultPresentation?: 'page' | 'dialog') {
    try {
      if (entry.pageId) await openPlugin(plugin.id,entry.pageId,defaultPresentation);
      else if (entry.commandId) await invoke('plugin_command_run', { pluginId:plugin.id,revision:plugin.packageRevision,commandId:entry.commandId });
    } catch (error) { notify(String(error)); }
  }
  watch([plugins, selectedId], () => {
    if (!dialogPlugin.value || !dialogPage.value) closeDialog();
    if (activeView.value === 'plugin-page' && (!activePlugin.value || !activePage.value)) activeView.value = 'plugins';
    if (!enabled() && activeView.value === 'plugins') activeView.value = 'library';
  });
  onMounted(() => {
    window.addEventListener(PLUGINS_CHANGED_EVENT, refresh);
    void listen('plugins://changed', refresh).then(stop => { if (disposed) stop(); else unlisten = stop; }).catch(() => {});
    void refresh();
    void listen<any>('plugins://ui', async event => {
      await refresh();
      const e = event.payload;
      const plugin = plugins.value.find(p => p.id === e.pluginId && p.packageRevision === e.revision);
      if (!plugin) return;
      if (e.method === 'lyrics.openSearch') showLyrics();
      else if (e.method === 'ui.notify') notify(e.params.message);
      else if (e.method === 'ui.openPage') {
        if (e.params.surface === 'desktop') await openPluginDesktop(plugin,e.params.pageId === 'renderer' ? '__renderer' : e.params.pageId).catch(error => notify(String(error)));
        else if (e.params.pageId === 'renderer') openRenderer(plugin.id);
        else await openPlugin(plugin.id,e.params.pageId);
      } else if (e.method === 'ui.openSettings') {
        settingsPluginId.value = plugin.id; activeView.value = 'plugins';
      } else if (e.method === 'ui.close' && e.surface === 'page') {
        if (dialogPlugin.value?.id === plugin.id) closeDialog();
        else if (activePlugin.value?.id === plugin.id) activeView.value = 'library';
      }
    }).then(stop => { if (disposed) stop(); else unlistenUi = stop; }).catch(() => {});
  });
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
    unlisten?.();
    unlistenUi?.();
    window.removeEventListener(PLUGINS_CHANGED_EVENT, refresh);
  });
  return { plugins, sidebarEntries, playbackEntries, activePlugin, activePage, dialogPlugin, dialogPage, closeDialog, openPlugin, launchPlugin, settingsPluginId };
}

const key: InjectionKey<ReturnType<typeof createPluginNavigation>> = Symbol('plugin-navigation');

export function providePluginNavigation(activeView: Ref<AppView>, enabled: () => boolean, notify: (message:string) => void, openRenderer: (id:string) => void, showLyrics: () => void) {
  provide(key, createPluginNavigation(activeView, enabled, notify, openRenderer, showLyrics));
}

export function usePluginNavigation() {
  const navigation = inject(key);
  if (!navigation) throw new Error('Plugin navigation provider is missing');
  return navigation;
}
