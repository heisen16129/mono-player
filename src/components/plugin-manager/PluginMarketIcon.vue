<script setup lang="ts">
import { computed } from 'vue';
import { ListMusic, Mic, Music, Palette, Plug, Tags, Wrench } from '@lucide/vue';
import type { PluginMarketItem } from '../../composables/usePluginMarket';

const props = withDefaults(defineProps<{
  icon?: string;
  kind: PluginMarketItem['kind'];
  variant?: 'card' | 'detail';
}>(), {
  variant: 'card',
});

const iconSize = computed(() => (props.variant === 'detail' ? 24 : 20));
</script>

<template>
  <span class="plugin-card-icon" :class="[kind, variant]">
    <img v-if="icon" :src="icon" alt="" draggable="false" />
    <Music v-else-if="kind === 'music'" :size="iconSize" />
    <Mic v-else-if="kind === 'lyrics'" :size="iconSize" />
    <Tags v-else-if="kind === 'metadata'" :size="iconSize" />
    <ListMusic v-else-if="kind === 'playlist'" :size="iconSize" />
    <Palette v-else-if="kind === 'theme'" :size="iconSize" />
    <Plug v-else-if="kind === 'integration'" :size="iconSize" />
    <Wrench v-else :size="iconSize" />
  </span>
</template>

<style scoped>
.plugin-card-icon {
  display: inline-grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-border) 78%, transparent);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-selected) 55%, transparent);
}

.plugin-card-icon.detail {
  width: 46px;
  height: 46px;
}

.plugin-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.plugin-card-icon.music,
.plugin-card-icon.lyrics {
  color: var(--smw-button-primary);
}

.plugin-card-icon.metadata,
.plugin-card-icon.playlist {
  color: var(--smw-status-green);
}

.plugin-card-icon.theme,
.plugin-card-icon.integration,
.plugin-card-icon.tool {
  color: var(--smw-text-body);
}
</style>
