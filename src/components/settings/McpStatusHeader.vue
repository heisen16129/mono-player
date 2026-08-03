<script setup lang="ts">
defineProps<{
  isRefreshing: boolean;
  statusLabel: string;
  statusTone: 'running' | 'stopped';
}>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <div class="mcp-status-head">
    <span class="mcp-status-pill" :class="statusTone">{{ statusLabel }}</span>
    <button class="secondary-button compact" type="button" :disabled="isRefreshing" @click="emit('refresh')">
      {{ isRefreshing ? '刷新中' : '刷新状态' }}
    </button>
  </div>
</template>

<style scoped>
.mcp-status-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mcp-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  font-weight: 680;
}

.mcp-status-pill.running {
  color: #087f5b;
  background: rgba(8, 127, 91, 0.12);
}

.mcp-status-pill.stopped {
  color: #b42318;
  background: rgba(180, 35, 24, 0.1);
}

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
