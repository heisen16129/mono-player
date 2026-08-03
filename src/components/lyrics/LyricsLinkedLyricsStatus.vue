<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <span class="lyrics-menu-linked" :title="`已关联歌词：${label}`">
    已关联歌词：{{ label }}
  </span>
</template>

<style scoped>
.lyrics-menu-linked {
  display: block;
  min-width: 0;
  overflow: hidden;
  padding: 8px 12px;
  color: var(--smw-text-body);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
