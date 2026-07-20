<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import blueWhitePreview from '../assets/theme-previews/blue-white.svg';
import darkPreview from '../assets/theme-previews/dark.svg';
import grayWhitePreview from '../assets/theme-previews/gray-white.svg';
import transparentPreview from '../assets/theme-previews/transparent.svg';
import { resolveLocale, t } from '../i18n';
import { getSystemThemeState, importThemeFolder } from '../services/music';
import { usePlayerStore } from '../stores/player';
import type { AppTheme, CustomTheme, SystemThemeState } from '../types/music';
import { getErrorMessage } from '../utils/error';
import PageHeader from './PageHeader.vue';
import SegmentTabs from './SegmentTabs.vue';
import LocalThemeGrid from './theme/LocalThemeGrid.vue';
import MarketThemeGrid from './theme/MarketThemeGrid.vue';
import type { BuiltInThemeCard, MarketThemeCard } from './theme/types';

const player = usePlayerStore();
const activeThemeTab = ref<'local' | 'market'>('local');
const themeTabItems = computed(() => [
  { id: 'local', label: t(player.settings.locale, 'localThemes') },
  { id: 'market', label: t(player.settings.locale, 'themeStore') },
]);
const systemThemePreviewMode = ref<SystemThemeState['mode']>('light');
const systemThemePreviewAccent = ref('#dfe4f2');
let unlistenSystemThemePreview: UnlistenFn | null = null;

const localThemeCards = computed<BuiltInThemeCard[]>(() => [
  {
    value: 'wallpaperTone',
    title: resolveLocale(player.settings.locale) === 'en-US' ? 'System theme' : '\u7cfb\u7edf\u4e3b\u9898',
    author: 'Mono Player',
    tone: `wallpaper-tone system-${systemThemePreviewMode.value}`,
  },
  {
    value: 'blueWhite',
    title: t(player.settings.locale, 'blueWhiteTheme'),
    author: 'Mono Player',
    tone: 'blue-white',
    previewUrl: blueWhitePreview,
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

const grayWhiteThemeVariables: Record<string, string> = {
  '--smw-bg-canvas': '#ffffff',
  '--smw-bg-page': '#f7f7f7',
  '--smw-bg-sidebar': '#f2f2f2',
  '--smw-bg-panel': '#fafafa',
  '--smw-library-bg': '#fafafa',
  '--smw-library-border': '#d9d9d9',
  '--smw-bg-workspace': '#ffffff',
  '--smw-bg-input': '#ffffff',
  '--smw-bg-selected': '#e9e9e9',
  '--smw-bg-hover': '#eeeeee',
  '--smw-border': '#d9d9d9',
  '--smw-border-soft': '#e7e7e7',
  '--smw-border-strong': '#1f1f1f',
  '--smw-window-border': '#bdbdbd',
  '--smw-player-bg': 'rgba(255, 255, 255, 0.94)',
  '--smw-shell-bg': '#ececec',
  '--smw-text-primary': '#111111',
  '--smw-text-body': '#222222',
  '--smw-text-secondary': '#777777',
  '--smw-text-muted': '#a0a0a0',
  '--smw-icon-muted': '#6f6f6f',
  '--smw-button-primary': '#2f2f2f',
  '--smw-scrollbar-thumb': 'rgba(17, 17, 17, 0.18)',
  '--smw-scrollbar-thumb-hover': 'rgba(17, 17, 17, 0.34)',
  '--smw-accent-blue': '#55b9ff',
  '--smw-lyrics-bg': '#ffffff',
  '--smw-lyrics-glow-left': 'rgba(0, 0, 0, 0.1)',
  '--smw-lyrics-glow-right': 'rgba(85, 185, 255, 0.1)',
  '--smw-lyrics-current': '#2f2f2f',
  '--smw-volume-bg': '#ffffff',
  '--smw-volume-track': '#d9d9d9',
  '--smw-volume-fill': '#2f2f2f',
  '--smw-volume-thumb': '#2f2f2f',
  '--smw-volume-text': '#777777',
  '--smw-progress-track': '#d9d9d9',
  '--smw-progress-fill': '#55b9ff',
  '--smw-progress-thumb': '#55b9ff',
  '--smw-progress-thumb-border': '#ffffff',
  '--smw-progress-thumb-ring': 'rgba(85, 185, 255, 0.24)',
};

const darkThemeVariables: Record<string, string> = {
  '--smw-bg-canvas': '#101010',
  '--smw-bg-page': '#151515',
  '--smw-bg-sidebar': '#121212',
  '--smw-bg-panel': '#171717',
  '--smw-library-bg': '#171717',
  '--smw-library-border': '#2f2f2f',
  '--smw-bg-workspace': '#1e1e1e',
  '--smw-bg-input': '#222222',
  '--smw-bg-selected': '#303030',
  '--smw-bg-hover': '#2a2a2a',
  '--smw-border': '#3a3a3a',
  '--smw-border-soft': '#2f2f2f',
  '--smw-border-strong': '#555555',
  '--smw-window-border': '#333333',
  '--smw-player-bg': 'rgba(18, 18, 18, 0.96)',
  '--smw-shell-bg': '#101010',
  '--smw-text-primary': '#e8e8e8',
  '--smw-text-body': '#d2d2d2',
  '--smw-text-secondary': '#a0a0a0',
  '--smw-text-muted': '#6f6f6f',
  '--smw-icon-muted': '#8a8a8a',
  '--smw-button-primary': '#8b8b8b',
  '--smw-scrollbar-thumb': 'rgba(232, 232, 232, 0.2)',
  '--smw-scrollbar-thumb-hover': 'rgba(232, 232, 232, 0.38)',
  '--smw-accent-blue': '#e8e8e8',
  '--smw-lyrics-bg': '#101010',
  '--smw-lyrics-glow-left': 'rgba(255, 255, 255, 0.07)',
  '--smw-lyrics-glow-right': 'rgba(85, 185, 255, 0.08)',
  '--smw-lyrics-current': '#f1f1f1',
  '--smw-volume-bg': '#202020',
  '--smw-volume-track': '#3a3a3a',
  '--smw-volume-fill': '#e8e8e8',
  '--smw-volume-thumb': '#e8e8e8',
  '--smw-volume-text': '#b8b8b8',
  '--smw-progress-track': '#3a3a3a',
  '--smw-progress-fill': '#e8e8e8',
  '--smw-progress-thumb': '#e8e8e8',
  '--smw-progress-thumb-border': '#202020',
  '--smw-progress-thumb-ring': 'rgba(232, 232, 232, 0.24)',
};

const transparentThemeVariables: Record<string, string> = {
  '--smw-bg-canvas': 'transparent',
  '--smw-bg-page': 'rgba(255, 255, 255, 0.46)',
  '--smw-bg-sidebar': 'rgba(255, 255, 255, 0.52)',
  '--smw-bg-panel': 'rgba(255, 255, 255, 0.44)',
  '--smw-library-bg': 'rgba(255, 255, 255, 0.44)',
  '--smw-library-border': 'rgba(17, 24, 39, 0.14)',
  '--smw-bg-workspace': 'rgba(255, 255, 255, 0.38)',
  '--smw-bg-input': 'rgba(255, 255, 255, 0.64)',
  '--smw-bg-selected': 'rgba(255, 255, 255, 0.42)',
  '--smw-bg-hover': 'rgba(255, 255, 255, 0.34)',
  '--smw-border': 'rgba(17, 24, 39, 0.14)',
  '--smw-border-soft': 'rgba(17, 24, 39, 0.1)',
  '--smw-border-strong': 'rgba(17, 24, 39, 0.48)',
  '--smw-window-border': 'rgba(255, 255, 255, 0.22)',
  '--smw-player-bg': 'rgba(255, 255, 255, 0.52)',
  '--smw-shell-bg': 'transparent',
  '--smw-text-primary': '#111827',
  '--smw-text-body': '#1f2937',
  '--smw-text-secondary': 'rgba(31, 41, 55, 0.72)',
  '--smw-text-muted': '#8a96a8',
  '--smw-icon-muted': 'rgba(31, 41, 55, 0.68)',
  '--smw-button-primary': 'rgba(31, 41, 55, 0.88)',
  '--smw-scrollbar-thumb': 'rgba(17, 24, 39, 0.2)',
  '--smw-scrollbar-thumb-hover': 'rgba(17, 24, 39, 0.34)',
  '--smw-accent-blue': '#4f9cff',
  '--smw-lyrics-bg': 'rgba(255, 255, 255, 0.38)',
  '--smw-lyrics-glow-left': 'rgba(255, 255, 255, 0.22)',
  '--smw-lyrics-glow-right': 'rgba(79, 156, 255, 0.12)',
  '--smw-lyrics-current': 'rgba(31, 41, 55, 0.88)',
  '--smw-volume-bg': 'rgba(255, 255, 255, 0.68)',
  '--smw-volume-track': 'rgba(17, 24, 39, 0.16)',
  '--smw-volume-fill': '#4f9cff',
  '--smw-volume-thumb': '#4f9cff',
  '--smw-volume-text': 'rgba(31, 41, 55, 0.72)',
  '--smw-progress-track': 'rgba(17, 24, 39, 0.16)',
  '--smw-progress-fill': '#4f9cff',
  '--smw-progress-thumb': '#4f9cff',
  '--smw-progress-thumb-border': 'rgba(255, 255, 255, 0.82)',
  '--smw-progress-thumb-ring': 'rgba(79, 156, 255, 0.24)',
};

const marketThemeCards = computed<MarketThemeCard[]>(() => [
  {
    id: 'custom:market-gray-white',
    title: t(player.settings.locale, 'lightTheme'),
    author: 'Mono Player',
    tone: 'light',
    previewUrl: grayWhitePreview,
    variables: grayWhiteThemeVariables,
  },
  {
    id: 'custom:market-dark',
    title: t(player.settings.locale, 'darkTheme'),
    author: 'Mono Player',
    tone: 'dark',
    previewUrl: darkPreview,
    variables: darkThemeVariables,
  },
  {
    id: 'custom:market-transparent',
    title: resolveLocale(player.settings.locale) === 'en-US' ? 'Transparent theme' : '\u900f\u660e\u4e3b\u9898',
    author: 'Mono Player',
    tone: 'desktop-glass',
    previewUrl: transparentPreview,
    variables: transparentThemeVariables,
  },
]);

const importThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Import theme' : '\u5bfc\u5165\u4e3b\u9898');
const themePackageText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Theme package folder' : '\u4e3b\u9898\u5305\u6587\u4ef6\u5939');
const deleteThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Delete theme' : '\u5220\u9664\u4e3b\u9898');
const downloadOnlyText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Download' : '\u4ec5\u4e0b\u8f7d');
const downloadUseText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Download & use' : '\u4e0b\u8f7d\u4f7f\u7528');
const downloadedText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Downloaded' : '\u5df2\u4e0b\u8f7d');
const useThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Use' : '\u4f7f\u7528');
const customThemeCards = computed(() => player.customThemes);

function selectTheme(theme: AppTheme) {
  player.setTheme(theme);
}

function removeCustomTheme(themeId: `custom:${string}`) {
  player.removeCustomTheme(themeId);
}

function isMarketThemeInstalled(themeId: CustomTheme['id']) {
  return player.customThemes.some((theme) => theme.id === themeId);
}

function installMarketTheme(theme: MarketThemeCard, useImmediately: boolean) {
  player.addCustomTheme({
    id: theme.id,
    name: theme.title,
    author: theme.author,
    variables: theme.variables,
    preview: theme.previewUrl,
  }, useImmediately);
}

function useOrInstallMarketTheme(theme: MarketThemeCard) {
  if (isMarketThemeInstalled(theme.id)) {
    selectTheme(theme.id);
    return;
  }

  installMarketTheme(theme, true);
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

function selectThemeTab(tab: string | null) {
  if (tab === 'local' || tab === 'market') {
    activeThemeTab.value = tab;
  }
}
</script>

<template>
  <section class="theme-view">
    <PageHeader class="theme-toolbar" :title="t(player.settings.locale, 'themeStyle')" title-class="theme-view-title" />

    <SegmentTabs label="Theme tabs" :items="themeTabItems" :model-value="activeThemeTab" root-class="theme-tabs" @select="selectThemeTab" />

    <LocalThemeGrid
      v-if="activeThemeTab === 'local'"
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

    <MarketThemeGrid
      v-else
      :downloaded-text="downloadedText"
      :download-only-text="downloadOnlyText"
      :download-use-text="downloadUseText"
      :is-market-theme-installed="isMarketThemeInstalled"
      :locale="player.settings.locale"
      :market-theme-cards="marketThemeCards"
      :selected-theme="player.settings.theme"
      :use-theme-text="useThemeText"
      @install-market-theme="installMarketTheme"
      @use-or-install-market-theme="useOrInstallMarketTheme"
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
