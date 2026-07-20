<script setup lang="ts">
import { CheckCircle2, Clock3, Disc3, Download, FolderOpen, Heart, IdCard, ImagePlus, ListPlus, PencilLine, PlayCircle, Trash2, User } from '@lucide/vue';
import { resolveLocale, t } from '../i18n';
import type { Locale, Track } from '../types/music';
import BaseContextMenu from './BaseContextMenu.vue';

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
  <BaseContextMenu :x="menu.x" :y="menu.y">
    <div class="context-menu-meta">
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
    <div class="context-menu-actions">
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
  </BaseContextMenu>
</template>
