<script setup lang="ts">
import { useScrollingState } from '../../composables/useScrollingState';
import type { PluginMarketCategory } from '../../composables/usePluginMarket';
import PluginMarketCategoryButton from './PluginMarketCategoryButton.vue';

defineProps<{
  activeCategory: PluginMarketCategory;
  categories: Array<{ id: PluginMarketCategory; label: string; description: string }>;
}>();

defineEmits<{
  select: [category: PluginMarketCategory];
}>();

const { isScrolling, showScrolling } = useScrollingState();
</script>

<template>
  <aside class="plugin-market-sidebar transient-scrollbar" :class="{ 'is-scrolling': isScrolling }" aria-label="插件分类" @scroll="showScrolling">
    <PluginMarketCategoryButton
      v-for="category in categories"
      :key="category.id"
      :active="activeCategory === category.id"
      :category="category"
      @select="$emit('select', $event)"
    />
  </aside>
</template>

<style scoped>
.plugin-market-sidebar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-input) 70%, transparent);
}

@media (max-width: 860px) {
  .plugin-market-sidebar {
    flex-direction: row;
    overflow-x: auto;
  }
}
</style>
