<script setup lang="ts">
import type { DownloadItem } from '../types/music';

defineProps<{
  item: DownloadItem | null | undefined;
}>();

function getStatusText(item: DownloadItem | null | undefined) {
  if (!item) return '';
  if (item.status === 'downloaded') return '已完成';
  if (item.status === 'failed') return item.error ? `失败：${item.error}` : '失败';
  if (item.status === 'paused') return '暂停';
  return `${Math.round(item.progress)}%`;
}
</script>

<template>
  <span>{{ getStatusText(item) }}</span>
</template>
