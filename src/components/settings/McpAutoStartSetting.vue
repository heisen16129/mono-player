<script setup lang="ts">
defineProps<{
  enabled: boolean;
  locale: string;
}>();

const emit = defineEmits<{
  setEnabled: [value: boolean];
}>();

function setEnabled(event: Event) {
  emit('setEnabled', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="setting-group">
    <p>{{ locale === 'en-US' ? 'Startup' : '\u542f\u52a8' }}</p>
    <label class="option-row">
      <input
        type="checkbox"
        :checked="enabled"
        @change="setEnabled"
      />
      {{ locale === 'en-US' ? 'Start the HTTP MCP service when Mono Player opens' : '\u6253\u5f00 Mono Player \u65f6\u81ea\u52a8\u542f\u52a8 HTTP MCP \u670d\u52a1' }}
    </label>
    <small class="mcp-note">{{ locale === 'en-US' ? 'This only controls startup behavior. You can start or stop the service below without restarting.' : '\u8fd9\u4ec5\u5f71\u54cd\u4e0b\u6b21\u542f\u52a8\u3002\u4e0b\u65b9\u53ef\u4ee5\u7acb\u5373\u542f\u52a8\u6216\u505c\u6b62\u670d\u52a1\u3002' }}</small>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.mcp-note {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
