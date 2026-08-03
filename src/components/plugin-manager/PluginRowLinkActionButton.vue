<script setup lang="ts">
import { Download, RefreshCw, Trash2 } from '@lucide/vue';

defineProps<{
  label: string;
  variant: 'danger' | 'install' | 'update';
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button class="link-action" :class="variant" type="button" @click="emit('click')">
    <Download v-if="variant === 'install'" :size="14" />
    <RefreshCw v-else-if="variant === 'update'" :size="14" />
    <Trash2 v-else :size="14" />
    {{ label }}
  </button>
</template>

<style scoped>
.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.link-action:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-action.install,
.link-action.update {
  color: var(--smw-status-green);
}

.link-action.danger {
  color: var(--smw-error-text);
}
</style>
