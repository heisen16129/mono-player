<script setup lang="ts">
import { Music2, UserRound } from '@lucide/vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';

const player = usePlayerStore();
const emit = defineEmits<{ openLibrary: [] }>();
defineProps<{
  summary: string;
  title: string;
}>();
</script>

<template>
  <div class="panel-title artists-list-head">
    <h1>
      {{ title }}
    </h1>
    <div class="header-actions">
      <button class="icon-button" type="button" :title="t(player.settings.locale, 'musicLibrary')" :aria-label="t(player.settings.locale, 'musicLibrary')" @click="emit('openLibrary')"><Music2 :size="18" /></button>
      <button class="icon-button" type="button" :title="title" :aria-label="title" aria-pressed="true"><UserRound :size="18" /></button>
    </div>
    <span class="artist-summary">{{ summary }}</span>
  </div>
</template>

<style scoped>
.panel-title {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 28px auto;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}

.panel-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.header-actions .icon-button {
  width: 28px;
  height: 28px;
}

.artist-summary {
  grid-column: 1 / -1;
  color: var(--smw-text-secondary);
  font-size: 13px;
  font-weight: 400;
}
</style>
