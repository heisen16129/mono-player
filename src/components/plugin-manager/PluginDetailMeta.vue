<script setup lang="ts">
import type { PluginMarketItem } from '../../composables/usePluginMarket';

defineProps<{
  plugin: PluginMarketItem;
}>();
</script>

<template>
  <dl class="plugin-detail-meta">
    <div><dt>版本</dt><dd>v{{ plugin.version }}</dd></div>
    <div v-if="plugin.installedVersion"><dt>已安装</dt><dd>v{{ plugin.installedVersion }}</dd></div>
    <div v-if="plugin.minAppVersion"><dt>最低版本</dt><dd>{{ plugin.minAppVersion }}</dd></div>
    <div><dt>来源</dt><dd>{{ plugin.source }}</dd></div>
    <div><dt>更新</dt><dd>{{ plugin.updatedAt }}</dd></div>
  </dl>
</template>

<style scoped>
.plugin-detail-meta {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-top: 2px;
  border-top: 1px solid var(--smw-border-soft);
}

.plugin-detail-meta div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}

.plugin-detail-meta dt,
.plugin-detail-meta dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-detail-meta dt {
  color: var(--smw-text-secondary);
}

.plugin-detail-meta dd {
  color: var(--smw-text-body);
}
</style>
