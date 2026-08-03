<script setup lang="ts">
defineProps<{
  artist: string;
  providerName: string;
  title: string;
}>();
</script>

<template>
  <span class="lyrics-search-meta">
    <strong>{{ title }}</strong>
    <small>{{ artist || '未知歌手' }} · {{ providerName }}</small>
  </span>
</template>

<style scoped>
.lyrics-search-meta {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.lyrics-search-meta strong,
.lyrics-search-meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-search-meta strong {
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 520;
}

.lyrics-search-meta small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
