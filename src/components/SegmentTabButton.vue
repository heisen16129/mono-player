<script setup lang="ts">
import type { SegmentTabItem } from './SegmentTabs.vue';

defineProps<{
  active: boolean;
  item: SegmentTabItem;
}>();

const emit = defineEmits<{
  select: [id: string | null];
}>();
</script>

<template>
  <button
    type="button"
    :class="{ active, disabled: item.disabled }"
    :disabled="item.disabled"
    @click="emit('select', item.id)"
  >
    {{ item.label }}
  </button>
</template>
