<script setup lang="ts">
import { computed, ref } from 'vue';
import DownloadItemContextMenu from './DownloadItemContextMenu.vue';
import DownloadManagerContent from './DownloadManagerContent.vue';
import DownloadManagerTabs from './DownloadManagerTabs.vue';
import { type DownloadManagerTab, useDownloadManagerItems } from '../composables/useDownloadManagerItems';
import type {
  DownloadItemContextMenuListeners,
  DownloadItemContextMenuState,
  DownloadManagerContentListeners,
  DownloadManagerContentProps,
  DownloadManagerViewEmits,
  DownloadManagerViewProps,
} from '../types/downloadManager';
import type { DownloadItem, Track } from '../types/music';

const props = defineProps<DownloadManagerViewProps>();

const emit = defineEmits<DownloadManagerViewEmits>();

const activeTab = ref<DownloadManagerTab>('downloaded');
const downloadContextMenu = ref<DownloadItemContextMenuState | null>(null);
const downloadTabs = [
  { id: 'downloaded', label: '已下载' },
  { id: 'downloading', label: '下载中' },
];
const { downloadItemForTrack, visibleTracks } = useDownloadManagerItems(() => props.items, activeTab);

const downloadEmptyMessage = computed(() => {
  return activeTab.value === 'downloaded' ? '还没有已下载歌曲' : '当前没有下载任务';
});

function openDownloadContextMenu(track: Track, x: number, y: number) {
  const item = downloadItemForTrack(track);
  if (!item) return;

  downloadContextMenu.value = { item, x, y };
}

function closeDownloadContextMenu() {
  downloadContextMenu.value = null;
}

function downloadRowClass(track: Track) {
  return {
    'is-context-open': downloadContextMenu.value?.item.id === downloadItemForTrack(track)?.id,
  };
}

const downloadManagerContentProps = computed<DownloadManagerContentProps>(() => ({
  activeTrack: props.activeTrack,
  downloadItemForTrack,
  emptyMessage: downloadEmptyMessage.value,
  favoriteTrackIds: props.favoriteTrackIds,
  isPlaying: props.isPlaying,
  rowClass: downloadRowClass,
  showFavoriteAction: activeTab.value === 'downloaded',
  spectrumLevels: props.spectrumLevels,
  tracks: visibleTracks.value,
}));

const downloadManagerContentListeners: DownloadManagerContentListeners = {
  onOpenTrackMenu: openDownloadContextMenu,
  onPlayTrack: (track) => emit('playTrack', track),
  onSelectTrack: (track) => emit('selectTrack', track),
  onToggleFavorite: (track) => emit('toggleFavorite', track),
};

const downloadItemContextMenuListeners: DownloadItemContextMenuListeners = {
  onAddToPlaylist: (item) => emitMenuAction('addToPlaylist', item),
  onClearRecord: (item) => emitMenuAction('clearRecord', item),
  onDeleteDownload: (item) => emitMenuAction('deleteDownload', item),
  onOpenFolder: (item) => emitMenuAction('openFolder', item),
  onPauseDownload: (item) => emitMenuAction('pauseDownload', item),
  onQueueNext: (item) => emitMenuAction('queueNext', item),
  onResumeDownload: (item) => emitMenuAction('resumeDownload', item),
  onRetryDownload: (item) => emitMenuAction('retryDownload', item),
};

function emitMenuAction(action: 'queueNext' | 'addToPlaylist' | 'deleteDownload' | 'clearRecord' | 'openFolder' | 'pauseDownload' | 'retryDownload' | 'resumeDownload', item: DownloadItem) {
  if (action === 'queueNext') emit('queueNext', item);
  if (action === 'addToPlaylist') emit('addToPlaylist', item);
  if (action === 'deleteDownload') emit('deleteDownload', item);
  if (action === 'clearRecord') emit('clearRecord', item);
  if (action === 'openFolder') emit('openFolder', item);
  if (action === 'pauseDownload') emit('pauseDownload', item);
  if (action === 'retryDownload') emit('retryDownload', item);
  if (action === 'resumeDownload') emit('resumeDownload', item);
  closeDownloadContextMenu();
}

function selectDownloadTab(tab: string | null) {
  if (tab === 'downloaded' || tab === 'downloading') activeTab.value = tab;
}
</script>

<template>
  <section class="download-manager-view" @click="closeDownloadContextMenu">
    <DownloadItemContextMenu
      v-if="downloadContextMenu"
      :menu="downloadContextMenu"
      v-bind="downloadItemContextMenuListeners"
    />

    <DownloadManagerTabs label="涓嬭浇绠＄悊" :items="downloadTabs" :model-value="activeTab" @select="selectDownloadTab" />

    <DownloadManagerContent
      v-bind="{ ...downloadManagerContentProps, ...downloadManagerContentListeners }"
    />
  </section>
</template>

<style scoped>
.download-manager-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 22px 20px 24px;
  background: var(--smw-bg-workspace);
}
</style>
