<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/player';
import McpServiceSettingsPanel from './McpServiceSettingsPanel.vue';
import ShortcutSettingsPanel from './ShortcutSettingsPanel.vue';

const player = usePlayerStore();
const isEnglish = computed(() => player.settings.locale === 'en-US');
</script>

<template>
  <section class="settings-section">
    <h2>{{ isEnglish ? 'System' : '系统' }}</h2>
    <details class="system-group" open>
      <summary>{{ isEnglish ? 'Shortcuts' : '快捷键' }}</summary>
      <ShortcutSettingsPanel />
    </details>
    <details class="system-group">
      <summary>{{ isEnglish ? 'MCP service' : 'MCP 服务' }}</summary>
      <McpServiceSettingsPanel />
    </details>
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 12px;
}

.system-group {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.system-group[open] > summary {
  margin-bottom: 14px;
}

.system-group :deep(.settings-section > h2) {
  display: none;
}
</style>
