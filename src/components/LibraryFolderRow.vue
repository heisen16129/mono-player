<script setup lang="ts">
import type { LocalFolderItem } from '../types/library';
import FolderCover from './FolderCover.vue';

defineProps<{
  countLabel: string;
  folder: LocalFolderItem;
  selected: boolean;
}>();

const emit = defineEmits<{
  open: [path: string];
}>();
</script>

<template>
  <button
    class="playlist-row"
    :class="{ selected }"
    type="button"
    :title="folder.path"
    @click="emit('open', folder.path)"
  >
    <FolderCover size="mini" :tracks="folder.tracks" :tone="folder.tone" />
    <span>
      <strong>{{ folder.title }}</strong>
      <small>{{ countLabel }}</small>
    </span>
  </button>
</template>

<style scoped>
.playlist-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.playlist-row:hover,
.playlist-row.selected {
  background: var(--smw-bg-selected);
}

.playlist-row strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 520;
}

.playlist-row small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
