<script setup lang="ts">
import type { PluginMarketItem } from '../../composables/usePluginMarket';
import PluginMarketIcon from './PluginMarketIcon.vue';

defineProps<{
  plugin: PluginMarketItem;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
}>();
</script>

<template>
  <div class="plugin-detail-heading">
    <PluginMarketIcon :icon="plugin.icon" :kind="plugin.kind" variant="detail" />
    <div>
      <h2>{{ plugin.name }}</h2>
      <p>{{ plugin.author }} · {{ pluginKindLabel(plugin.kind) }} · {{ plugin.runtime }}</p>
    </div>
  </div>
</template>

<style scoped>
.plugin-detail-heading {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.plugin-detail-heading h2,
.plugin-detail-heading p {
  margin: 0;
}

.plugin-detail-heading h2 {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 18px;
  font-weight: 760;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-detail-heading p {
  color: var(--smw-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}
</style>
