<script setup lang="ts">
import { Download, Trash2 } from '@lucide/vue';

defineProps<{
  busy: boolean;
  enabledCount: number;
  installableCount: number;
  selectedCount: number;
}>();

const emit = defineEmits<{
  disable: [];
  install: [];
  uninstall: [];
}>();
</script>

<template>
  <div class="plugin-bulk-bar" :class="{ active: selectedCount > 0 }">
    <span>已选择 {{ selectedCount }} 个插件</span>
    <button class="secondary-button compact" type="button" :disabled="busy || installableCount === 0" @click="emit('install')">
      <Download :size="15" />
      批量安装
    </button>
    <button class="secondary-button compact" type="button" :disabled="busy || selectedCount === 0" @click="emit('uninstall')">
      <Trash2 :size="15" />
      批量卸载
    </button>
    <button class="secondary-button compact" type="button" :disabled="busy || enabledCount === 0" @click="emit('disable')">
      批量停用
    </button>
  </div>
</template>

<style scoped>
.plugin-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  width: fit-content;
  min-height: 42px;
  margin: 0 0 14px;
  padding: 6px 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-input) 78%, transparent);
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.plugin-bulk-bar.active {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: color-mix(in srgb, var(--smw-bg-selected) 58%, var(--smw-bg-input));
}
</style>
