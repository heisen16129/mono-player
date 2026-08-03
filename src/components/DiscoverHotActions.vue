<script setup lang="ts">
import { Flame, UserRound } from '@lucide/vue';

const emit = defineEmits<{
  search: [keyword: string];
}>();
</script>

<template>
  <div class="discover-actions">
    <button type="button" @click="emit('search', '热门歌曲')">
      <Flame :size="18" />
      <span>热门歌曲</span>
    </button>
    <button type="button" @click="emit('search', '热门歌手')">
      <UserRound :size="18" />
      <span>热门歌手</span>
    </button>
  </div>
</template>

<style scoped>
.discover-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
}

.discover-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  min-height: 42px;
  gap: 9px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
  font: inherit;
  font-size: 15px;
  font-weight: 560;
  cursor: pointer;
}

.discover-actions button:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: var(--smw-bg-hover);
}
</style>
