<script setup lang="ts">
import EmptyState from '../EmptyState.vue';

defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  openSearch: [];
}>();
</script>

<template>
  <EmptyState class-name="lyrics-empty" :message="message">
    <template #action>
      <button class="lyrics-search-link" type="button" @click.stop="emit('openSearch')">搜索歌词</button>
    </template>
  </EmptyState>
</template>

<style scoped>
:deep(.lyrics-empty) {
  display: grid;
  min-height: 0;
  gap: 8px;
  align-content: center;
  justify-items: center;
}

.lyrics-search-link {
  padding: 0;
  border: 0;
  color: var(--smw-accent-blue, #2f7df6);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
}

.lyrics-search-link:hover,
.lyrics-search-link:focus-visible {
  text-decoration: underline;
  outline: none;
}
</style>
