<script setup lang="ts">
import type { PluginMarketStatus } from '../../composables/usePluginMarket';

defineProps<{
  activeStatus: 'all' | PluginMarketStatus;
  filters: Array<{ id: 'all' | PluginMarketStatus; label: string }>;
}>();

const emit = defineEmits<{
  select: [status: 'all' | PluginMarketStatus];
}>();
</script>

<template>
  <div class="plugin-market-filters" aria-label="安装状态筛选">
    <button
      v-for="filter in filters"
      :key="filter.id"
      type="button"
      :class="{ active: activeStatus === filter.id }"
      @click="emit('select', filter.id)"
    >
      {{ filter.label }}
    </button>
  </div>
</template>

<style scoped>
.plugin-market-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.plugin-market-filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.plugin-market-filters button.active {
  border-color: transparent;
  color: #fff;
  background: var(--smw-button-primary);
}
</style>
