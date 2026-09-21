<script setup lang="ts">
import { marketCategories } from '../../composables/usePluginMarket';
defineProps<{ kind: string }>();
</script>

<template>
  <span class="runtime-badge">{{ marketCategories.find(category => category.id === kind)?.label ?? '插件' }}</span>
</template>

<style scoped>
.runtime-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: color-mix(in srgb, var(--smw-bg-selected) 55%, transparent);
  font-size: 12px;
}
</style>
