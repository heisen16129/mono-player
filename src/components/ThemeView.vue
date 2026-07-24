<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import blueWhitePreview from '../assets/theme-previews/blue-white.svg';
import { resolveLocale, t } from '../i18n';
import { getSystemThemeState, importThemeFolder } from '../services/music';
import { listInstalledPlugins, readPluginTheme, uninstallPlugin } from '../services/plugins';
import { usePlayerStore } from '../stores/player';
import type { AppTheme, CustomTheme, SystemThemeState } from '../types/music';
import type { PluginManifest } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import PageHeader from './PageHeader.vue';
import LocalThemeGrid from './theme/LocalThemeGrid.vue';
import type { BuiltInThemeCard } from './theme/types';

const player = usePlayerStore();
const systemThemePreviewMode = ref<SystemThemeState['mode']>('light');
const systemThemePreviewAccent = ref('#dfe4f2');
let unlistenSystemThemePreview: UnlistenFn | null = null;

const localThemeCards = computed<BuiltInThemeCard[]>(() => [
  {
    value: 'blueWhite',
    title: t(player.settings.locale, 'blueWhiteTheme'),
    author: 'Mono Player',
    tone: 'blue-white',
    previewUrl: blueWhitePreview,
  },
  {
    value: 'wallpaperTone',
    title: resolveLocale(player.settings.locale) === 'en-US' ? 'System theme' : '\u7cfb\u7edf\u4e3b\u9898',
    author: 'Mono Player',
    tone: `wallpaper-tone system-${systemThemePreviewMode.value}`,
  },
]);

const systemThemePreviewStyle = computed(() => ({
  '--system-preview-accent': systemThemePreviewAccent.value,
}));

function updateSystemThemePreview(state: SystemThemeState) {
  systemThemePreviewMode.value = state.mode;
  systemThemePreviewAccent.value = state.wallpaperColor
    ? `rgb(${state.wallpaperColor.r} ${state.wallpaperColor.g} ${state.wallpaperColor.b})`
    : state.mode === 'dark'
      ? '#6d7480'
      : '#dfe4f2';
}

async function refreshSystemThemePreview() {
  try {
    const state = await getSystemThemeState();
    updateSystemThemePreview(state);
  } catch {
    systemThemePreviewMode.value = 'light';
    systemThemePreviewAccent.value = '#dfe4f2';
  }
}

onMounted(async () => {
  void refreshSystemThemePreview();
  unlistenSystemThemePreview = await listen<SystemThemeState>('system-theme-changed', (event) => {
    updateSystemThemePreview(event.payload);
  });
  window.addEventListener('focus', refreshSystemThemePreview);
});

onUnmounted(() => {
  window.removeEventListener('focus', refreshSystemThemePreview);
  unlistenSystemThemePreview?.();
});

const importThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Import theme' : '\u5bfc\u5165\u4e3b\u9898');
const themePackageText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Theme package folder' : '\u4e3b\u9898\u5305\u6587\u4ef6\u5939');
const deleteThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Delete theme' : '\u5220\u9664\u4e3b\u9898');
const customThemeCards = computed(() => player.customThemes);

function selectTheme(theme: AppTheme) {
  player.setTheme(theme);
}

function pluginThemeId(themeId: string | undefined, fallbackId: string): CustomTheme['id'] {
  const id = themeId?.trim() || fallbackId;
  return (id.startsWith('custom:') ? id : `custom:${id}`) as CustomTheme['id'];
}

async function pluginThemeMatches(manifest: PluginManifest, themeId: CustomTheme['id']) {
  if (manifest.kind !== 'theme' || !manifest.capabilities.includes('theme')) return false;

  try {
    const theme = await readPluginTheme(manifest);
    return pluginThemeId(theme.id, manifest.id) === themeId;
  } catch {
    return pluginThemeId(undefined, manifest.id) === themeId;
  }
}

async function removeInstalledThemePlugin(themeId: CustomTheme['id']) {
  const installedPlugins = await listInstalledPlugins();
  for (const plugin of installedPlugins) {
    if (await pluginThemeMatches(plugin, themeId)) {
      await uninstallPlugin(plugin.id);
      return;
    }
  }
}

function removeCustomTheme(themeId: `custom:${string}`) {
  player.removeCustomTheme(themeId);
  void removeInstalledThemePlugin(themeId).catch((error) => {
    player.error = getErrorMessage(error, '主题插件卸载失败');
  });
}

function customPreviewStyle(variables: Record<string, string>) {
  return {
    '--cover-page': variables['--smw-bg-workspace'] || variables['--smw-bg-canvas'] || '#f5f5f5',
    '--cover-sidebar': variables['--smw-bg-sidebar'] || variables['--smw-bg-panel'] || '#ffffff',
    '--cover-border': variables['--smw-border'] || '#d9d9d9',
    '--cover-selected': variables['--smw-bg-selected'] || variables['--smw-bg-panel'] || '#e9e9e9',
    '--cover-line': variables['--smw-text-secondary'] || variables['--smw-button-primary'] || '#777777',
    '--cover-line-soft': variables['--smw-border-soft'] || variables['--smw-border'] || '#e7e7e7',
  };
}

function customPreviewSrc(theme: CustomTheme) {
  if (!theme.preview) return '';
  if (/^(https?:|data:|blob:|\/)/.test(theme.preview)) return theme.preview;

  return convertFileSrc(theme.preview);
}

async function importCustomTheme() {
  const selected = await open({
    directory: true,
    multiple: false,
    title: importThemeText.value,
  });
  if (!selected || Array.isArray(selected)) return;

  try {
    const theme = await importThemeFolder(selected);
    player.addCustomTheme(theme);
  } catch (err) {
    player.error = getErrorMessage(err);
  }
}

</script>

<template>
  <section class="theme-view">
    <PageHeader class="theme-toolbar" :title="t(player.settings.locale, 'themeStyle')" title-class="theme-view-title" />

    <LocalThemeGrid
      :custom-preview-src="customPreviewSrc"
      :custom-preview-style="customPreviewStyle"
      :custom-theme-cards="customThemeCards"
      :delete-theme-text="deleteThemeText"
      :import-theme-text="importThemeText"
      :local-theme-cards="localThemeCards"
      :locale="player.settings.locale"
      :selected-theme="player.settings.theme"
      :system-theme-preview-style="systemThemePreviewStyle"
      :theme-package-text="themePackageText"
      @import-theme="importCustomTheme"
      @remove-custom-theme="removeCustomTheme"
      @select-theme="selectTheme"
    />
  </section>
</template>

<style scoped>
.theme-view {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 12px 22px 40px;
  background: var(--smw-bg-workspace);
}
</style>
