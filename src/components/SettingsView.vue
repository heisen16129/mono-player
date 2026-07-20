<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import PageHeader from './PageHeader.vue';
import SegmentTabs from './SegmentTabs.vue';
import GeneralSettingsPanel from './settings/GeneralSettingsPanel.vue';
import LyricsSettingsPanel from './settings/LyricsSettingsPanel.vue';
import McpSettingsPanel from './settings/McpSettingsPanel.vue';
import PlaybackSettingsPanel from './settings/PlaybackSettingsPanel.vue';
import PluginSettingsPanel from './settings/PluginSettingsPanel.vue';

const player = usePlayerStore();
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
    <PageHeader class="settings-header" :title="t(locale, 'preferences')">
      <SegmentTabs :label="t(locale, 'settings')" :items="settingsTabItems" :model-value="activeTab" root-class="settings-tabs" @select="selectSettingsTab" />
    </PageHeader>

    <div class="settings-content">
      <GeneralSettingsPanel v-if="activeTab === 'settings'" />

      <PlaybackSettingsPanel v-else-if="activeTab === 'playback'" />

      <LyricsSettingsPanel v-else-if="activeTab === 'lyrics'" />

      <McpSettingsPanel v-else-if="activeTab === 'mcp'" />

      <PluginSettingsPanel v-else-if="activeTab === 'plugins'" />

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

  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 34px 40px;
  background: var(--smw-bg-workspace);
  scrollbar-width: none;
}

.settings-view::-webkit-scrollbar {
  display: none;
}

.settings-content {
  display: grid;
  max-width: 980px;
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
</style>
