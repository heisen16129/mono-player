<script setup lang="ts">
import { Check, Plus, Trash2 } from '@lucide/vue';
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

const player = usePlayerStore();
const activeThemeTab = ref<'local' | 'market'>('local');
const systemThemePreviewMode = ref<SystemThemeState['mode']>('light');
const systemThemePreviewAccent = ref('#dfe4f2');
let unlistenSystemThemePreview: UnlistenFn | null = null;

type BuiltInThemeCard = {
  value: Exclude<AppTheme, `custom:${string}`>;
  title: string;
  author: string;
  tone: string;
  previewUrl?: string;
};

type MarketThemeCard = {
  id: CustomTheme['id'];
  title: string;
  author: string;
  tone: string;
  previewUrl: string;
  variables: Record<string, string>;
};

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
    player.error = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <section class="theme-view">
    <header class="theme-toolbar">
      <h1 class="theme-view-title">{{ t(player.settings.locale, 'themeStyle') }}</h1>
    </header>

    <nav class="theme-tabs" aria-label="Theme tabs">
      <button
        :class="{ active: activeThemeTab === 'local' }"
        type="button"
        @click="activeThemeTab = 'local'"
      >
        {{ t(player.settings.locale, 'localThemes') }}
      </button>
      <button
        :class="{ active: activeThemeTab === 'market' }"
        type="button"
        @click="activeThemeTab = 'market'"
      >
        {{ t(player.settings.locale, 'themeStore') }}
      </button>
    </nav>

    <div v-if="activeThemeTab === 'local'" class="theme-grid-list">
      <button class="theme-card theme-import-card" type="button" @click="importCustomTheme">
        <span class="theme-card-preview theme-card-import-preview">
          <Plus :size="42" />
        </span>
        <strong>{{ importThemeText }}</strong>
        <small>{{ themePackageText }}</small>
      </button>

      <button
        v-for="theme in localThemeCards"
        :key="theme.value"
        class="theme-card"
        :class="{ selected: player.settings.theme === theme.value }"
        type="button"
        @click.stop="selectTheme(theme.value)"
      >
        <span
          class="theme-card-preview"
          :class="theme.tone"
          :style="theme.value === 'wallpaperTone' ? systemThemePreviewStyle : undefined"
        >
          <img v-if="theme.previewUrl" class="theme-card-image" :src="theme.previewUrl" alt="" draggable="false" />
          <span class="theme-card-cover" aria-hidden="true"></span>
          <Check v-if="player.settings.theme === theme.value" class="theme-card-check" :size="18" />
        </span>
        <strong>{{ theme.title }}</strong>
        <small>{{ t(player.settings.locale, 'author') }}: {{ theme.author }}</small>
      </button>

      <article
        v-for="theme in customThemeCards"
        :key="theme.id"
        class="theme-card"
        :class="{ selected: player.settings.theme === theme.id }"
        role="button"
        tabindex="0"
        @click.stop="selectTheme(theme.id)"
        @keydown.enter.stop.prevent="selectTheme(theme.id)"
        @keydown.space.stop.prevent="selectTheme(theme.id)"
      >
        <span class="theme-card-preview custom-theme-preview" :style="customPreviewStyle(theme.variables)">
          <img
            v-if="customPreviewSrc(theme)"
            class="theme-card-image"
            :src="customPreviewSrc(theme)"
            alt=""
            draggable="false"
          />
          <span v-else class="theme-card-cover" aria-hidden="true"></span>
          <button
            class="theme-card-delete"
            type="button"
            :aria-label="deleteThemeText"
            :title="deleteThemeText"
            @click.stop="removeCustomTheme(theme.id)"
            @keydown.enter.stop.prevent="removeCustomTheme(theme.id)"
            @keydown.space.stop.prevent="removeCustomTheme(theme.id)"
          >
            <Trash2 :size="14" />
          </button>
          <Check v-if="player.settings.theme === theme.id" class="theme-card-check" :size="18" />
        </span>
        <strong>{{ theme.name }}</strong>
        <small>{{ t(player.settings.locale, 'author') }}: {{ theme.author }}</small>
      </article>
    </div>

    <div v-else class="theme-grid-list">
      <article
        v-for="theme in marketThemeCards"
        :key="theme.id"
        class="theme-card market-theme-card"
        :class="{ selected: player.settings.theme === theme.id }"
      >
        <span class="theme-card-preview" :class="theme.tone">
          <img class="theme-card-image" :src="theme.previewUrl" alt="" draggable="false" />
          <span class="theme-card-cover" aria-hidden="true"></span>
          <span class="theme-card-actions">
            <button
              class="theme-card-action"
              :class="{ installed: isMarketThemeInstalled(theme.id) }"
              type="button"
              :disabled="isMarketThemeInstalled(theme.id)"
              @click.stop="installMarketTheme(theme, false)"
            >
              {{ isMarketThemeInstalled(theme.id) ? downloadedText : downloadOnlyText }}
            </button>
            <button
              class="theme-card-action primary"
              type="button"
              @click.stop="useOrInstallMarketTheme(theme)"
            >
              {{ isMarketThemeInstalled(theme.id) ? useThemeText : downloadUseText }}
            </button>
          </span>
          <Check v-if="player.settings.theme === theme.id" class="theme-card-check" :size="18" />
        </span>
        <strong>{{ theme.title }}</strong>
        <small>{{ t(player.settings.locale, 'author') }}: {{ theme.author }}</small>
      </article>
    </div>
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

.theme-toolbar {
  display: flex;
  align-items: center;
  min-height: 42px;
}

.theme-view-title {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 18px;
  font-weight: 720;
  line-height: 1.2;
}

.theme-tabs {
  display: flex;
  gap: 30px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.theme-tabs button {
  position: relative;
  height: 38px;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font-size: 14px;
  cursor: pointer;
}

.theme-tabs button.active {
  color: var(--smw-text-primary);
  font-weight: 700;
}

.theme-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.theme-grid-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 28px 38px;
  align-items: start;
  padding-top: 24px;
}

.theme-card {
  display: grid;
  gap: 7px;
  width: 150px;
  padding: 0;
  border: 0;
  color: var(--smw-text-primary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.theme-card:focus {
  outline: none;
}

.theme-card-preview {
  position: relative;
  display: grid;
  place-items: center;
  width: 150px;
  height: 100px;
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.theme-card:hover .theme-card-preview {
  transform: translateY(-1px);
  border-color: var(--smw-text-secondary);
}

.theme-card.selected .theme-card-preview {
  border-color: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 18%, transparent);
}

.theme-card:focus-visible .theme-card-preview {
  border-color: color-mix(in srgb, var(--smw-button-primary) 58%, var(--smw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 16%, transparent);
}

.theme-card-preview.light {
  --cover-page: #f7f7f7;
  --cover-sidebar: #ffffff;
  --cover-border: #e3e3e3;
  --cover-selected: #e9e9e9;
  --cover-line: #909090;
  --cover-line-soft: #d5d5d5;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #ffffff, #f2f2f2);
}

.theme-card-preview.dark {
  --cover-page: #151515;
  --cover-sidebar: #101010;
  --cover-border: #303030;
  --cover-selected: #2e2e2e;
  --cover-line: #8d8d8d;
  --cover-line-soft: #444444;
  color: #f5f5f5;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #101010, #2c2c2c);
}

.theme-card-preview.blue-white {
  --cover-page: #fbfdff;
  --cover-sidebar: #f8fbff;
  --cover-border: #e2edf8;
  --cover-selected: #edf6ff;
  --cover-line: #4a90e2;
  --cover-line-soft: #dbe8f6;
  color: #4a90e2;
  background:
    linear-gradient(90deg, rgba(74, 144, 226, 0.12) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #ffffff 0%, #f5f5f7 58%, #eaf3ff 100%);
}

.theme-card-preview.wallpaper-tone.system-light {
  --system-preview-base: #fbfbfd;
  --system-preview-accent: #dfe4f2;
  --cover-page: color-mix(in srgb, var(--system-preview-base), black 0%);
  --cover-sidebar: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 34%);
  --cover-border: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 58%);
  --cover-selected: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 46%);
  --cover-line: #2f2f2f;
  --cover-line-soft: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 58%);
  color: #2f2f2f;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--cover-border) 46%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, var(--cover-page), color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 32%));
}

.theme-card-preview.wallpaper-tone.system-dark {
  --system-preview-base: #0f0f10;
  --cover-page: var(--system-preview-base);
  --cover-sidebar: color-mix(in srgb, var(--system-preview-base), white 6%);
  --cover-border: color-mix(in srgb, var(--system-preview-base), white 18%);
  --cover-selected: color-mix(in srgb, var(--system-preview-base), white 16%);
  --cover-line: #e8e8e8;
  --cover-line-soft: color-mix(in srgb, var(--system-preview-base), white 24%);
  color: #e8e8e8;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--cover-border) 42%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, var(--cover-page), color-mix(in srgb, var(--system-preview-base), white 7%));
}

.theme-card-preview.desktop-glass {
  --cover-page: rgba(245, 251, 255, 0.54);
  --cover-sidebar: rgba(255, 255, 255, 0.58);
  --cover-border: rgba(17, 24, 39, 0.12);
  --cover-selected: rgba(255, 255, 255, 0.48);
  --cover-line: rgba(31, 41, 55, 0.42);
  --cover-line-soft: rgba(31, 41, 55, 0.16);
  color: var(--smw-button-primary);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.22) 1px, transparent 1px) 0 0 / 18px 18px,
    radial-gradient(circle at 26% 34%, rgba(255, 255, 255, 0.5), transparent 34%),
    radial-gradient(circle at 76% 62%, rgba(210, 236, 255, 0.38), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.22));
}

.theme-card:not(.theme-import-card) .theme-card-preview {
  color: transparent;
  background: var(--cover-page, var(--smw-bg-panel));
}

.theme-card-cover {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--cover-sidebar), var(--cover-sidebar)) 0 0 / 42px 100% no-repeat,
    linear-gradient(var(--cover-border), var(--cover-border)) 42px 0 / 1px 100% no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 9px 15px / 24px 11px no-repeat,
    linear-gradient(var(--cover-line), var(--cover-line)) 55px 15px / 34px 5px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 27px / 70px 4px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 39px / 58px 4px no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 55px 56px / 76px 13px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 76px / 64px 4px no-repeat,
    var(--cover-page);
}

.theme-card-image {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.theme-card-image + .theme-card-cover {
  display: none;
}

.theme-card-cover::before,
.theme-card-cover::after {
  position: absolute;
  content: "";
}

.theme-card-preview.light .theme-card-cover::before,
.theme-card-preview.blue-white .theme-card-cover::before,
.theme-card-preview.wallpaper-tone .theme-card-cover::before,
.theme-card-preview.desktop-glass .theme-card-cover::before,
.custom-theme-preview .theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--cover-line) 14%, transparent);
}

.theme-card-preview.light .theme-card-cover::after,
.theme-card-preview.blue-white .theme-card-cover::after,
.theme-card-preview.wallpaper-tone .theme-card-cover::after,
.theme-card-preview.desktop-glass .theme-card-cover::after,
.custom-theme-preview .theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cover-line) 18%, transparent);
}

.theme-card-preview.dark .theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
}

.theme-card-preview.dark .theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}

.theme-card-import-preview {
  border-style: dashed;
  color: var(--smw-icon-muted);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--smw-border-soft) 70%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    var(--smw-bg-panel);
}

.theme-import-card:hover .theme-card-import-preview {
  color: var(--smw-text-primary);
}

.custom-theme-preview {
  background: var(--cover-page, var(--smw-bg-panel));
}

.theme-card-check {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 50%;
  color: #ffffff;
  background: var(--smw-button-primary);
}

.theme-card-actions {
  position: absolute;
  right: auto;
  top: 50%;
  bottom: auto;
  left: 50%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 5px;
  opacity: 0;
  transform: translate(-50%, calc(-50% + 2px));
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.theme-card-action {
  max-width: 82px;
  min-height: 26px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease;
}

.theme-card:hover .theme-card-actions,
.theme-card:focus-within .theme-card-actions {
  opacity: 1;
  transform: translate(-50%, -50%);
}

.theme-card-action.primary,
.theme-card-action.installed {
  color: #ffffff;
  background: var(--smw-button-primary);
}

.theme-card-action:disabled {
  cursor: default;
}

.market-theme-card.selected .theme-card-check {
  top: 8px;
  bottom: auto;
}

.theme-card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  display: grid;
  width: 23px;
  height: 23px;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-border) 72%, transparent);
  border-radius: 50%;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 140ms ease,
    color 140ms ease,
    background 140ms ease;
}

.theme-card:hover .theme-card-delete,
.theme-card:focus-within .theme-card-delete {
  opacity: 1;
  pointer-events: auto;
}

.theme-card-delete:hover,
.theme-card-delete:focus-visible {
  color: #e5484d;
  background: color-mix(in srgb, #e5484d 12%, var(--smw-bg-panel));
  outline: none;
}

.theme-card strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-card small {
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
