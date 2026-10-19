<script setup lang="ts">
import { computed, ref } from 'vue';
import { useScrollingState } from '../composables/useScrollingState';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import GeneralSettingsPanel from './settings/GeneralSettingsPanel.vue';
import LyricsSettingsPanel from './settings/LyricsSettingsPanel.vue';
import InterfaceSettingsPanel from './settings/InterfaceSettingsPanel.vue';
import SystemSettingsPanel from './settings/SystemSettingsPanel.vue';
import PlaybackSettingsPanel from './settings/PlaybackSettingsPanel.vue';
import PluginSettingsPanel from './settings/PluginSettingsPanel.vue';
import SettingsHeader from './settings/SettingsHeader.vue';
import SettingsTabs from './settings/SettingsTabs.vue';

const player = usePlayerStore();
defineEmits<{ close: [] }>();
const { isScrolling, showScrolling } = useScrollingState();
const tabKeys = ['settings', 'interface', 'playback', 'lyrics', 'plugins', 'system'] as const;
const activeTab = ref<(typeof tabKeys)[number]>('settings');
const locale = computed(() => player.settings.locale);
const settingsTabItems = computed(() => {
  const labels = locale.value === 'en-US'
    ? ['General', 'Interface', 'Playback', 'Lyrics', 'Plugins', 'System']
    : ['常用', '界面', '播放', '歌词', '插件', '系统'];
  return tabKeys.map((id, index) => ({ id, label: labels[index] }));
});

function selectSettingsTab(tab: string | null) {
  if (tab && tabKeys.includes(tab as (typeof tabKeys)[number])) {
    activeTab.value = tab as (typeof tabKeys)[number];
  }
}
</script>

<template>
  <section class="settings-view">
    <SettingsHeader :title="t(locale, 'preferences')" :locale="locale" @close="$emit('close')" />
    <SettingsTabs :label="t(locale, 'settings')" :items="settingsTabItems" :model-value="activeTab" @select="selectSettingsTab" />

    <div class="settings-content transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="showScrolling">
      <GeneralSettingsPanel v-if="activeTab === 'settings'" />

      <InterfaceSettingsPanel v-else-if="activeTab === 'interface'" />

      <PlaybackSettingsPanel v-else-if="activeTab === 'playback'" />

      <LyricsSettingsPanel v-else-if="activeTab === 'lyrics'" />

      <PluginSettingsPanel v-else-if="activeTab === 'plugins'" />

      <SystemSettingsPanel v-else-if="activeTab === 'system'" />
    </div>
  </section>
</template>

<style scoped>
.settings-view :deep(details) {
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-panel) 92%, var(--smw-bg-input));
}

.settings-view :deep(details > summary) {
  cursor: pointer;
  position: relative;
  display: flex;
  min-height: 52px;
  box-sizing: border-box;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 2px;
  margin: 0;
  padding: 9px 42px 9px 12px;
  list-style: none;
  color: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.settings-view :deep(details > summary:hover) {
  background: var(--smw-bg-hover);
}

.settings-view :deep(details > summary::-webkit-details-marker) {
  display: none;
}

.settings-view :deep(details > summary::after) {
  content: '';
  position: absolute;
  right: 17px;
  top: calc(50% - 4px);
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--smw-icon-muted);
  border-bottom: 1.5px solid var(--smw-icon-muted);
  transform: rotate(-45deg);
}

.settings-view :deep(details[open] > summary::after) {
  content: '';
  transform: rotate(45deg);
}

.settings-view :deep(details > summary small) {
  margin: 0;
  font-size: 11px;
  line-height: 1.3;
  font-weight: 400;
}

.settings-view :deep(details > :not(summary)) {
  margin: 0 9px 9px;
}

.settings-view {
  --button-min-height: 32px;
  --button-padding-x: 12px;

  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 18px 0;
  background: var(--smw-bg-workspace);
}

.settings-content {
  display: block;
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 2px 20px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--smw-border);
}

.settings-section h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 720;
}

.settings-content :deep(.settings-section) {
  gap: 12px;
  border-bottom: 0;
  padding-bottom: 0;
}

.settings-content > :deep(.settings-section > h2) {
  display: none;
  margin: 0 0 2px;
  font-size: 13px;
  color: var(--smw-text-secondary);
  font-weight: 600;
}

.settings-content :deep(.settings-section > .setting-group) {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

.settings-content :deep(.setting-group > p) {
  font-weight: 650;
}

.settings-content :deep(.option-list),
.settings-content :deep(.inline-options) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-content :deep(.option-row) {
  position: relative;
  display: inline-flex;
  flex: 1 1 0;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  min-height: 36px;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.settings-content :deep(.option-row input:is([type='radio'], [type='checkbox'])) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.settings-content :deep(.option-row:hover) {
  background: var(--smw-bg-hover);
  color: var(--smw-text-primary);
}

.settings-content :deep(.option-row:has(input:checked)),
.settings-content :deep(.toggle-button[aria-pressed='true']),
.settings-content :deep(.source-action.active) {
  z-index: 1;
  border-color: var(--smw-border-strong);
  background: var(--smw-bg-selected);
  color: var(--smw-text-primary);
  font-weight: 650;
  box-shadow: none;
}

.settings-content :deep(.option-row:has(input:focus-visible)) {
  z-index: 2;
  outline: 2px solid var(--smw-button-primary);
  outline-offset: 2px;
}

.settings-content :deep(.option-row:has(input[type='checkbox'])) {
  justify-content: center;
  text-align: center;
}

.settings-content :deep(.option-list:has(input[type='checkbox'])),
.settings-content :deep(.inline-options:has(input[type='checkbox'])) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-content :deep(.option-row:has(input[type='checkbox']):last-child:nth-child(odd)) {
  grid-column: 1 / -1;
}

.settings-content :deep(.option-list:has(input[type='radio'])),
.settings-content :deep(.inline-options:has(input[type='radio'])) {
  gap: 0;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

.settings-content :deep(.option-list .option-row:has(input[type='radio'])),
.settings-content :deep(.inline-options .option-row:has(input[type='radio'])) {
  border-radius: 0;
  border-color: transparent;
}

.settings-content :deep(.option-row:has(input[type='radio']):first-child) {
  border-radius: 7px 0 0 7px;
}

.settings-content :deep(.option-row:has(input[type='radio']):last-child) {
  border-radius: 0 7px 7px 0;
}

.settings-content :deep(.option-row:has(input[type='radio']:checked)) {
  border-color: var(--smw-border-strong);
}

.settings-content :deep(.shortcut-row) {
  grid-template-columns: minmax(100px, 1fr) minmax(0, 1.2fr);
  gap: 12px;
}

@media (max-width: 400px) {
  .settings-content :deep(.shortcut-row) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
