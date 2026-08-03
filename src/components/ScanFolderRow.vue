<script setup lang="ts">
import { Trash2 } from '@lucide/vue';

defineProps<{
  confirming: boolean;
  folder: { path: string; checked: boolean };
}>();

const emit = defineEmits<{
  remove: [path: string];
  updateChecked: [path: string, checked: boolean];
}>();
</script>

<template>
  <label class="scan-folder-row">
    <input
      :checked="folder.checked"
      type="checkbox"
      :disabled="confirming"
      @change="emit('updateChecked', folder.path, ($event.target as HTMLInputElement).checked)"
    />
    <span>{{ folder.path }}</span>
    <button
      class="icon-button scan-delete-button"
      type="button"
      title="删除"
      :disabled="confirming"
      @click.prevent="emit('remove', folder.path)"
    >
      <Trash2 :size="17" />
    </button>
  </label>
</template>

<style scoped>
.scan-folder-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 0 8px;
  color: var(--smw-text-body);
  font-size: 12px;
}

.scan-folder-row:hover {
  background: color-mix(in srgb, var(--smw-bg-hover) 72%, transparent);
}

.scan-folder-row input {
  width: 14px;
  height: 14px;
  accent-color: var(--smw-text-primary);
}

.scan-folder-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-delete-button {
  color: var(--smw-text-secondary);
}

.scan-delete-button:hover {
  color: var(--smw-text-primary);
}
</style>
