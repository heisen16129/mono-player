<script setup lang="ts">
import SegmentTabs, { type SegmentTabItem } from '../SegmentTabs.vue';

defineProps<{
  items: SegmentTabItem[];
  label: string;
  modelValue: string | null;
}>();

defineEmits<{
  select: [id: string | null];
}>();
</script>

<template>
  <div class="settings-navigation">
    <SegmentTabs :items="items" :label="label" :model-value="modelValue" root-class="settings-tabs" @select="$emit('select', $event)" />
  </div>
</template>

<style scoped>
.settings-navigation {
  flex: 0 0 auto;
}

:deep(.settings-tabs) {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  flex: 0 0 auto;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

:deep(.settings-tabs button) {
  height: 32px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

:deep(.settings-tabs button:hover) {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

:deep(.settings-tabs button.active) {
  color: var(--smw-text-primary);
  border-color: var(--smw-border);
  background: var(--smw-bg-input);
  box-shadow: 0 1px 3px rgb(0 0 0 / 4%);
}

:deep(.settings-tabs button.active::after) {
  display: none;
}
</style>
