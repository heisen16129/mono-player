<script setup lang="ts">
import { computed, ref } from 'vue';
import { useScrollingState } from '../composables/useScrollingState';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import GeneralSettingsPanel from './settings/GeneralSettingsPanel.vue';
import LyricsSettingsPanel from './settings/LyricsSettingsPanel.vue';
import McpSettingsPanel from './settings/McpSettingsPanel.vue';
import PlaybackSettingsPanel from './settings/PlaybackSettingsPanel.vue';
import PluginSettingsPanel from './settings/PluginSettingsPanel.vue';
import SettingsHeader from './settings/SettingsHeader.vue';
import SettingsTabs from './settings/SettingsTabs.vue';
import ShortcutSettingsPanel from './settings/ShortcutSettingsPanel.vue';

const player = usePlayerStore();
const { isScrolling, showScrolling } = useScrollingState();
const tabKeys = ['settings', 'playback', 'lyrics', 'mcp', 'plugins', 'shortcuts', 'network', 'backup'] as const;
const activeTab = ref<(typeof tabKeys)[number]>('settings');
const locale = computed(() => player.settings.locale);
const settingsTabItems = computed(() => tabKeys.map((tab) => ({ id: tab, label: t(locale.value, tab) })));

function selectSettingsTab(tab: string | null) {
  if (tab && tabKeys.includes(tab as (typeof tabKeys)[number])) {
    activeTab.value = tab as (typeof tabKeys)[number];
  }
}
</script>

<template>
  <section class="settings-view">
    <SettingsHeader :title="t(locale, 'preferences')">
      <SettingsTabs :label="t(locale, 'settings')" :items="settingsTabItems" :model-value="activeTab" @select="selectSettingsTab" />
    </SettingsHeader>

    <div class="settings-content transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" @scroll="showScrolling">
      <GeneralSettingsPanel v-if="activeTab === 'settings'" />

      <PlaybackSettingsPanel v-else-if="activeTab === 'playback'" />

      <LyricsSettingsPanel v-else-if="activeTab === 'lyrics'" />

      <McpSettingsPanel v-else-if="activeTab === 'mcp'" />

      <PluginSettingsPanel v-else-if="activeTab === 'plugins'" />

      <ShortcutSettingsPanel v-else-if="activeTab === 'shortcuts'" />

      <section v-else class="settings-section">
        <h2>{{ t(locale, activeTab) }}</h2>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-view {
  --button-min-height: 36px;
  --button-padding-x: 14px;

  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px 34px 40px;
  background: var(--smw-bg-workspace);
}

.settings-content {
  display: block;
  flex: 1 1 0;
  max-width: 980px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-top: 18px;
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

@media (max-width: 820px) {
  .settings-view {
    padding: 20px 18px 0;
  }

  .settings-content {
    padding-bottom: 128px;
  }
}
</style>
