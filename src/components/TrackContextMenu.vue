<script setup lang="ts">
import { CheckCircle2, Clock3, Disc3, Download, FolderOpen, Heart, IdCard, ImagePlus, ListPlus, PencilLine, PlayCircle, Trash2, User } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resolveLocale, t } from '../i18n';
import type { Locale, Track } from '../types/music';

const props = defineProps<{
  menu: { track: Track; x: number; y: number };
  activePlaylistId: string | null;
  canEditMetadata?: boolean;
  canChangeCover?: boolean;
  canRefreshDuration?: boolean;
  isDownloaded?: boolean;
  isFavorite: boolean;
  locale: Locale;
}>();

const emit = defineEmits<{
  queueNext: [track: Track];
  queueLast: [track: Track];
  addToFavorite: [track: Track];
  addToPlaylist: [track: Track];
  downloadTrack: [track: Track];
  editMetadata: [track: Track];
  changeCover: [track: Track];
  refreshDuration: [track: Track];
  removeFromPlaylist: [track: Track];
  openFolder: [track: Track];
}>();

const menuRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ left: props.menu.x, top: props.menu.y });

function updateMenuPosition() {
  const element = menuRef.value;
  if (!element) return;

  const margin = 10;
  const rect = element.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - margin;
  const maxTop = window.innerHeight - rect.height - margin;
  const shouldOpenAbove = props.menu.y + rect.height + margin > window.innerHeight;

  menuPosition.value = {
    left: Math.max(margin, Math.min(props.menu.x, maxLeft)),
    top: shouldOpenAbove
      ? Math.max(margin, props.menu.y - rect.height)
      : Math.max(margin, Math.min(props.menu.y, maxTop)),
  };
}

async function scheduleMenuPositionUpdate() {
  await nextTick();
  updateMenuPosition();
}

watch(() => props.menu, scheduleMenuPositionUpdate, { deep: true });

onMounted(() => {
  void scheduleMenuPositionUpdate();
  window.addEventListener('resize', updateMenuPosition);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMenuPosition);
});

function getTrackSourceLabel(track: Track) {
  return track.sourceName
    ?? pluginIdFromPath(track.path)
    ?? (resolveLocale(props.locale) === 'en-US' ? 'Local' : '本地');
}

function getTrackSourceId(track: Track) {
  return track.sourceId ?? String(track.id).padStart(10, '0');
}

function isOnlineTrack(track: Track) {
  return Boolean(track.sourceName) || track.path.startsWith('plugin://') || /^https?:\/\//i.test(track.path);
}

function pluginIdFromPath(path: string) {
  const match = path.match(/^plugin:\/\/([^/]+)/);
  return match?.[1] ?? null;
}
</script>

<template>
  <div
    ref="menuRef"
    class="track-context-menu"
    :style="{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }"
    role="menu"
    @click.stop
    @contextmenu.prevent.stop
  >
    <div class="track-context-meta">
      <div>
        <IdCard :size="15" />
        <span>ID: {{ getTrackSourceLabel(menu.track) }}@{{ getTrackSourceId(menu.track) }}</span>
      </div>
      <div>
        <User :size="15" />
        <span>作者: {{ menu.track.artist || t(locale, 'unknownArtist') }}</span>
      </div>
      <div>
        <Disc3 :size="15" />
        <span>专辑: {{ menu.track.album || t(locale, 'localMusic') }}</span>
      </div>
    </div>
    <div class="track-context-actions">
      <button type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('queueNext', menu.track)">
        <PlayCircle :size="16" />
        下一首播放
      </button>
      <button type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('addToPlaylist', menu.track)">
        <ListPlus :size="16" />
        添加到歌单
      </button>
      <button type="button" role="menuitem" :disabled="isFavorite" @click="emit('addToFavorite', menu.track)">
        <Heart :size="16" />
        {{ isFavorite ? '已收藏' : '添加到收藏' }}
      </button>
      <button v-if="isOnlineTrack(menu.track) && isDownloaded" type="button" role="menuitem" disabled>
        <CheckCircle2 :size="16" />
        已下载
      </button>
      <button v-if="isOnlineTrack(menu.track) && !isDownloaded" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('downloadTrack', menu.track)">
        <Download :size="16" />
        下载
      </button>
      <button v-if="!isOnlineTrack(menu.track)" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('queueLast', menu.track)">
        <ListPlus :size="16" />
        添加到播放队列
      </button>
      <button v-if="activePlaylistId" type="button" role="menuitem" @click="emit('removeFromPlaylist', menu.track)">
        <Trash2 :size="16" />
        {{ resolveLocale(locale) === 'en-US' ? 'Remove from playlist' : '从歌单内删除' }}
      </button>
      <button v-if="canEditMetadata && !isOnlineTrack(menu.track)" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('editMetadata', menu.track)">
        <PencilLine :size="16" />
        更改元数据
      </button>
      <button v-if="canChangeCover && !isOnlineTrack(menu.track)" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('changeCover', menu.track)">
        <ImagePlus :size="16" />
        更换封面
      </button>
      <button v-if="canRefreshDuration && !isOnlineTrack(menu.track)" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('refreshDuration', menu.track)">
        <Clock3 :size="16" />
        重新读取歌曲时长
      </button>
      <button v-if="!isOnlineTrack(menu.track)" type="button" role="menuitem" :disabled="!menu.track.path" @click="emit('openFolder', menu.track)">
        <FolderOpen :size="16" />
        打开歌曲所在文件夹
      </button>
    </div>
  </div>
</template>

<style scoped>
.track-context-menu {
  position: fixed;
  z-index: 320;
  display: grid;
  min-width: 238px;
  max-width: min(310px, calc(100vw - 24px));
  max-height: calc(100vh - 20px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-workspace) 96%, transparent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
}

.track-context-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.track-context-menu button:hover:not(:disabled) {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.track-context-menu svg {
  color: var(--smw-icon-muted);
}

.track-context-menu button:disabled {
  cursor: default;
  opacity: 0.48;
}

.track-context-meta {
  display: grid;
  gap: 2px;
  padding: 4px 0 6px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.track-context-meta > div {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.track-context-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-context-actions {
  display: grid;
  gap: 2px;
  padding-top: 6px;
}
</style>
