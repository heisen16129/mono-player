<script setup lang="ts">
import { CheckCircle2, ListMusic, Mic, Music, Palette, Plug, Tags, Wrench } from '@lucide/vue';
import type { PluginMarketCategory } from '../../composables/usePluginMarket';

defineProps<{
  active: boolean;
  category: { id: PluginMarketCategory; label: string; description: string };
}>();

const emit = defineEmits<{
  select: [category: PluginMarketCategory];
}>();
</script>

<template>
  <button
    type="button"
    :class="['plugin-category-button', { active }]"
    @click="emit('select', category.id)"
  >
    <Music v-if="category.id === 'music'" :size="16" />
    <Mic v-else-if="category.id === 'lyrics'" :size="16" />
    <Tags v-else-if="category.id === 'metadata'" :size="16" />
    <ListMusic v-else-if="category.id === 'playlist'" :size="16" />
    <Palette v-else-if="category.id === 'theme'" :size="16" />
    <Plug v-else-if="category.id === 'integration'" :size="16" />
    <Wrench v-else-if="category.id === 'tool'" :size="16" />
    <CheckCircle2 v-else :size="16" />
    <span>
      <strong>{{ category.label }}</strong>
      <small>{{ category.description }}</small>
    </span>
  </button>
</template>

<style scoped>
.plugin-category-button {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.plugin-category-button:hover,
.plugin-category-button.active {
  border-color: color-mix(in srgb, var(--smw-border) 72%, transparent);
  background: var(--smw-bg-hover);
}

.plugin-category-button.active {
  color: var(--smw-text-primary);
  box-shadow: inset 2px 0 0 var(--smw-button-primary);
}

.plugin-category-button svg {
  color: var(--smw-icon-muted);
}

.plugin-category-button strong,
.plugin-category-button small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-category-button strong {
  font-size: 13px;
  font-weight: 700;
}

.plugin-category-button small {
  margin-top: 2px;
  color: var(--smw-text-secondary);
  font-size: 11px;
}

@media (max-width: 860px) {
  .plugin-category-button {
    min-width: 170px;
  }
}
</style>
