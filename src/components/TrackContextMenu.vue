<script setup lang="ts">
import { CheckCircle2, Clock3, Download, FolderOpen, Heart, ImagePlus, ListPlus, PencilLine, PlayCircle, Trash2 } from '@lucide/vue';
import { resolveLocale, t } from '../i18n';
import type { TrackContextMenuEmits, TrackContextMenuProps } from '../types/appContextMenus';
import type { Track } from '../types/music';
import BaseContextMenu from './BaseContextMenu.vue';
import ContextMenuAction from './ContextMenuAction.vue';
import TrackContextMenuMeta from './TrackContextMenuMeta.vue';

const props = defineProps<TrackContextMenuProps>();

const emit = defineEmits<TrackContextMenuEmits>();

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
    <TrackContextMenuMeta
      :album-label="menu.track.album || t(locale, 'localMusic')"
      :artist-label="menu.track.artist || t(locale, 'unknownArtist')"
      :source-id="getTrackSourceId(menu.track)"
      :source-label="getTrackSourceLabel(menu.track)"
    />
    <div class="context-menu-actions">
      <ContextMenuAction :disabled="!menu.track.path" @action="emit('queueNext', menu.track)">
        <PlayCircle :size="16" />
        下一首播放
      </ContextMenuAction>
      <ContextMenuAction :disabled="!menu.track.path" @action="emit('addToPlaylist', menu.track)">
        <ListPlus :size="16" />
        添加到歌单
      </ContextMenuAction>
      <ContextMenuAction :disabled="isFavorite" @action="emit('addToFavorite', menu.track)">
        <Heart :size="16" />
        {{ isFavorite ? '已收藏' : '添加到收藏' }}
      </ContextMenuAction>
      <ContextMenuAction v-if="isOnlineTrack(menu.track) && isDownloaded" disabled>
        <CheckCircle2 :size="16" />
        已下载
      </ContextMenuAction>
      <ContextMenuAction v-if="isOnlineTrack(menu.track) && !isDownloaded" :disabled="!menu.track.path" @action="emit('downloadTrack', menu.track)">
        <Download :size="16" />
        下载
      </ContextMenuAction>
      <ContextMenuAction v-if="!isOnlineTrack(menu.track)" :disabled="!menu.track.path" @action="emit('queueLast', menu.track)">
        <ListPlus :size="16" />
        添加到播放队列
      </ContextMenuAction>
      <ContextMenuAction v-if="activePlaylistId" @action="emit('removeFromPlaylist', menu.track)">
        <Trash2 :size="16" />
        {{ resolveLocale(locale) === 'en-US' ? 'Remove from playlist' : '从歌单内删除' }}
      </ContextMenuAction>
      <ContextMenuAction v-if="canEditMetadata && !isOnlineTrack(menu.track)" :disabled="!menu.track.path" @action="emit('editMetadata', menu.track)">
        <PencilLine :size="16" />
        更改元数据
      </ContextMenuAction>
      <ContextMenuAction v-if="canChangeCover && !isOnlineTrack(menu.track)" :disabled="!menu.track.path" @action="emit('changeCover', menu.track)">
        <ImagePlus :size="16" />
        更换封面
      </ContextMenuAction>
      <ContextMenuAction v-if="canRefreshDuration && !isOnlineTrack(menu.track)" :disabled="!menu.track.path" @action="emit('refreshDuration', menu.track)">
        <Clock3 :size="16" />
        重新读取歌曲时长
      </ContextMenuAction>
      <ContextMenuAction v-if="!isOnlineTrack(menu.track)" :disabled="!menu.track.path" @action="emit('openFolder', menu.track)">
        <FolderOpen :size="16" />
        打开歌曲所在文件夹
      </ContextMenuAction>
    </div>
  </BaseContextMenu>
</template>
