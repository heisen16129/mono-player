<script setup lang="ts">
import LyricsEmptyState from './LyricsEmptyState.vue';

defineProps<{
  emptyMessage: string;
  isLyricsPending: boolean;
  linesCount: number;
  loadingText: string;
}>();

const emit = defineEmits<{
  openSearch: [];
}>();
</script>

<template>
  <small v-if="isLyricsPending" class="lyrics-hint">{{ loadingText }}</small>
  <LyricsEmptyState v-else-if="!linesCount" :message="emptyMessage" @open-search="emit('openSearch')" />
</template>

<style scoped>
.lyrics-hint {
  color: var(--smw-text-muted);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
}

</style>
