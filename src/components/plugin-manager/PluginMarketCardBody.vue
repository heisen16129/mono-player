<script setup lang="ts">
import type { PluginMarketItem, PluginMarketStatus } from '../../composables/usePluginMarket';

defineProps<{
  plugin: PluginMarketItem;
  pluginKindLabel: (kind: PluginMarketItem['kind']) => string;
  pluginStatusLabel: (status: PluginMarketStatus) => string;
}>();
</script>

<template>
  <span class="plugin-card-body">
    <span class="plugin-card-title-row">
      <strong>{{ plugin.name }}</strong>
      <span :class="['plugin-status-badge', plugin.status]">{{ pluginStatusLabel(plugin.status) }}</span>
    </span>
    <span class="plugin-card-meta">{{ plugin.author }} · v{{ plugin.version }} · {{ plugin.runtime }}</span>
    <span class="plugin-card-description">{{ plugin.description }}</span>
    <span class="plugin-card-tags">
      <span>{{ pluginKindLabel(plugin.kind) }}</span>
      <span v-for="tag in plugin.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
    </span>
  </span>
</template>

<style scoped>
.plugin-card-body,
.plugin-card-title-row,
.plugin-card-meta,
.plugin-card-description,
.plugin-card-tags {
  min-width: 0;
}

.plugin-card-body {
  display: grid;
  gap: 5px;
}

.plugin-card-title-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.plugin-card-title-row strong {
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-card-meta,
.plugin-card-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-card-meta {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.plugin-card-description {
  color: var(--smw-text-body);
  font-size: 13px;
}

.plugin-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-card-tags span,
.plugin-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 7px;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-selected) 50%, transparent);
  font-size: 11px;
  white-space: nowrap;
}

.plugin-status-badge.installed {
  color: var(--smw-status-green);
}

.plugin-status-badge.update {
  color: var(--smw-button-primary);
}
</style>
