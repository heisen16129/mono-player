<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core';
import { computed } from 'vue';
import blueWhitePreview from '../assets/theme-previews/blue-white.svg';
import { resolveLocale, t } from '../i18n';
import { listInstalledPlugins, readPluginTheme, uninstallPlugin } from '../services/plugins';
import { usePlayerStore } from '../stores/player';
import type { AppTheme, CustomTheme } from '../types/music';
import type { PluginManifest } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import LocalThemeGrid from './theme/LocalThemeGrid.vue';
import ThemeHeader from './theme/ThemeHeader.vue';
import type { BuiltInThemeCard, LocalThemeGridListeners, LocalThemeGridProps } from './theme/types';

const player = usePlayerStore();

const localThemeCards = computed<BuiltInThemeCard[]>(() => [
  {
    value: 'blueWhite',
    title: t(player.settings.locale, 'blueWhiteTheme'),
    author: 'Mono Player',
    tone: 'blue-white',
    previewUrl: blueWhitePreview,
  },
]);

const deleteThemeText = computed(() => resolveLocale(player.settings.locale) === 'en-US' ? 'Delete theme' : '\u5220\u9664\u4e3b\u9898');
const customThemeCards = computed(() => player.customThemes);
const localThemeGridProps = computed<LocalThemeGridProps>(() => ({
  customPreviewSrc,
  customPreviewStyle,
  customThemeCards: customThemeCards.value,
  deleteThemeText: deleteThemeText.value,
  localThemeCards: localThemeCards.value,
  locale: player.settings.locale,
  selectedTheme: player.settings.theme,
}));

const localThemeGridListeners: LocalThemeGridListeners = {
  onRemoveCustomTheme: removeCustomTheme,
  onSelectTheme: selectTheme,
};

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

</script>

<template>
  <section class="theme-view">
    <ThemeHeader :title="t(player.settings.locale, 'themeStyle')" />

    <LocalThemeGrid
      v-bind="{ ...localThemeGridProps, ...localThemeGridListeners }"
    />
  </section>
</template>

<style scoped>
.theme-view {
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: auto;
  padding: 12px 22px 40px;
  background: var(--smw-bg-workspace);
}
</style>
