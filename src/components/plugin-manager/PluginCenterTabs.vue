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
  <SegmentTabs :items="items" :label="label" :model-value="modelValue" root-class="plugin-center-tabs" @select="$emit('select', $event)" />
</template>
