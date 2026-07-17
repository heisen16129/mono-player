<script setup lang="ts">
import { computed, ref } from 'vue';
import DownloadItemContextMenu from './DownloadItemContextMenu.vue';
import TrackTable from './TrackTable.vue';
import type { DownloadItem, Track } from '../types/music';

const props = defineProps<{
  activeTrack: Track | null;
  favoriteTrackIds: number[];
  isPlaying: boolean;
  items: DownloadItem[];
}>();

const emit = defineEmits<{
  queueNext: [item: DownloadItem];
  addToPlaylist: [item: DownloadItem];
  deleteDownload: [item: DownloadItem];
  clearRecord: [item: DownloadItem];
  openFolder: [item: DownloadItem];
  pauseDownload: [item: DownloadItem];
  retryDownload: [item: DownloadItem];
  resumeDownload: [item: DownloadItem];
  playTrack: [track: Track];
  selectTrack: [track: Track];
  toggleFavorite: [track: Track];
}>();

const activeTab = ref<'downloaded' | 'downloading'>('downloaded');
const downloadContextMenu = ref<{ item: DownloadItem; x: number; y: number } | null>(null);

const visibleItems = computed(() => {
  return props.items.filter((item) => {
    if (activeTab.value === 'downloaded') return item.status === 'downloaded';
    return item.status === 'downloading' || item.status === 'failed' || item.status === 'paused';
  });
});

const visibleTracks = computed(() => visibleItems.value.map(toDownloadTrack));

const itemByTrackId = computed(() => new Map(
  visibleItems.value.map((item) => [hashDownloadItemId(item.id), item]),
));

function getStatusText(item: DownloadItem | null | undefined) {
  if (!item) return '';
  if (item.status === 'downloaded') return '已完成';
  if (item.status === 'failed') return item.error ? `失败：${item.error}` : '失败';
  if (item.status === 'paused') return '暂停';
  return `${Math.round(item.progress)}%`;
}

function openDownloadContextMenu(track: Track, x: number, y: number) {
  const item = downloadItemForTrack(track);
  if (!item) return;

  downloadContextMenu.value = { item, x, y };
}

function closeDownloadContextMenu() {
  downloadContextMenu.value = null;
}

function hashDownloadItemId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

function toDownloadTrack(item: DownloadItem): Track {
  return {
    id: hashDownloadItemId(item.id),
    path: item.filePath ?? '',
    title: item.title,
    artist: item.artist,
    album: item.album,
    duration: item.duration,
    artwork: item.artwork ?? null,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
  };
}

function downloadItemForTrack(track: Track) {
  return itemByTrackId.value.get(track.id) ?? null;
}

function downloadRowClass(track: Track) {
  return {
    'is-context-open': downloadContextMenu.value?.item.id === downloadItemForTrack(track)?.id,
  };
}

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
</script>

<template>
  <section class="download-manager-view" @click="closeDownloadContextMenu">
    <DownloadItemContextMenu
      v-if="downloadContextMenu"
      :menu="downloadContextMenu"
      @queue-next="emitMenuAction('queueNext', $event)"
      @add-to-playlist="emitMenuAction('addToPlaylist', $event)"
      @delete-download="emitMenuAction('deleteDownload', $event)"
      @clear-record="emitMenuAction('clearRecord', $event)"
      @open-folder="emitMenuAction('openFolder', $event)"
      @pause-download="emitMenuAction('pauseDownload', $event)"
      @retry-download="emitMenuAction('retryDownload', $event)"
      @resume-download="emitMenuAction('resumeDownload', $event)"
    />

    <header class="download-tabs" aria-label="下载管理">
      <button
        type="button"
        :class="{ active: activeTab === 'downloaded' }"
        @click="activeTab = 'downloaded'"
      >
        已下载
      </button>
      <button
        type="button"
        :class="{ active: activeTab === 'downloading' }"
        @click="activeTab = 'downloading'"
      >
        下载中
      </button>
    </header>

    <TrackTable
      v-if="visibleTracks.length > 0"
      :active-track="activeTrack"
      disable-internal-paging
      enable-context-menu
      extra-columns="118px 88px"
      :favorite-track-ids="favoriteTrackIds"
      :is-playing="isPlaying"
      label="下载管理"
      :row-class="downloadRowClass"
      :tracks="visibleTracks"
      wide
      @open-track-menu="openDownloadContextMenu"
      @play-track="emit('playTrack', $event)"
      @select-track="emit('selectTrack', $event)"
      @toggle-favorite="emit('toggleFavorite', $event)"
    >
      <template #extraHead>
        <span>来源</span>
        <span>状态</span>
      </template>
      <template #extraCells="{ track }">
        <span><i>{{ downloadItemForTrack(track)?.sourceName }}</i></span>
        <span>{{ getStatusText(downloadItemForTrack(track)) }}</span>
      </template>
    </TrackTable>

    <p v-else class="download-empty">
      {{ activeTab === 'downloaded' ? '还没有已下载歌曲' : '当前没有下载任务' }}
    </p>
  </section>
</template>

<style scoped>
.download-manager-view {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 22px 20px 24px;
  background: var(--smw-bg-workspace);
}

.download-tabs {
  display: flex;
  gap: 26px;
  align-items: center;
  min-height: 36px;
  padding: 0 0 14px;
}

.download-tabs button {
  position: relative;
  height: 30px;
  padding: 0 0 4px;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}

.download-tabs button.active {
  color: var(--smw-text-primary);
  font-weight: 700;
}

.download-tabs button.active::after {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--smw-button-primary);
  content: "";
}

.download-manager-view :deep(.track-table) {
  min-height: 0;
  overflow: auto;
}

.download-manager-view :deep(.track-row.is-context-open) {
  background: var(--smw-bg-selected);
}

.download-manager-view :deep(.track-row i) {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  color: #fff;
  background: var(--smw-button-primary);
  font-style: normal;
  font-weight: 650;
}

.download-empty {
  display: grid;
  min-height: 220px;
  place-items: center;
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
