<script setup lang="ts">
import { computed, ref } from 'vue';
import type { McpServiceSnapshot } from '../../services/mcp';
import { usePlayerStore } from '../../stores/player';
import McpAutoStartSetting from './McpAutoStartSetting.vue';
import McpCapabilitySummary from './McpCapabilitySummary.vue';
import McpConnectionSettings from './McpConnectionSettings.vue';
import McpStatusPanel from './McpStatusPanel.vue';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const mcpService = ref<McpServiceSnapshot | null>(null);
const serviceTitle = computed(() => (locale.value === 'en-US' ? 'HTTP MCP service' : 'HTTP MCP \u670d\u52a1'));
</script>

<template>
  <section class="settings-section mcp-settings-section">
    <h2>MCP</h2>

    <McpAutoStartSetting
      :enabled="player.settings.mcpAutoStart"
      :locale="locale"
      @set-enabled="player.setMcpAutoStart"
    />

    <div class="setting-group">
      <p>{{ serviceTitle }}</p>
      <McpStatusPanel :locale="locale" @change="mcpService = $event" />
    </div>

    <McpConnectionSettings :locale="locale" :service="mcpService" />

    <McpCapabilitySummary :locale="locale" />
  </section>
</template>

<style scoped>
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

.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.mcp-settings-section {
  max-width: 880px;
}
</style>
