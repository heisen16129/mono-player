<script setup lang="ts">
import DownloadManagerView from './DownloadManagerView.vue';
import type { AppDownloadsPageOutletEmits, AppDownloadsPageOutletProps } from '../types/appPageOutlet';
import type { DownloadManagerViewListeners } from '../types/downloadManager';

const props = defineProps<AppDownloadsPageOutletProps>();

const emit = defineEmits<AppDownloadsPageOutletEmits>();

const downloadManagerViewListeners: DownloadManagerViewListeners = {
  onQueueNext: (...args) => emit('queueNext', ...args),
  onAddToPlaylist: (...args) => emit('addToPlaylist', ...args),
  onDeleteDownload: (...args) => emit('deleteDownload', ...args),
  onClearRecord: (...args) => emit('clearRecord', ...args),
  onOpenFolder: (...args) => emit('openFolder', ...args),
  onPauseDownload: (...args) => emit('pauseDownload', ...args),
  onRetryDownload: (...args) => emit('retryDownload', ...args),
  onResumeDownload: (...args) => emit('resumeDownload', ...args),
  onPlayTrack: (...args) => emit('playTrack', ...args),
  onSelectTrack: (...args) => emit('selectTrack', ...args),
  onToggleFavorite: (...args) => emit('toggleFavorite', ...args),
};
</script>

<template>
  <DownloadManagerView
    v-bind="{ ...props, ...downloadManagerViewListeners }"
  />
</template>


