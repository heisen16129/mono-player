<script setup lang="ts">
import { FolderOpen, ListPlus, PauseCircle, PlayCircle, RotateCcw, Trash2, XCircle } from '@lucide/vue';
import type { DownloadItemContextMenuEmits, DownloadItemContextMenuProps } from '../types/downloadManager';
import BaseContextMenu from './BaseContextMenu.vue';
import ContextMenuAction from './ContextMenuAction.vue';
import TrackContextMenuMeta from './TrackContextMenuMeta.vue';

defineProps<DownloadItemContextMenuProps>();

const emit = defineEmits<DownloadItemContextMenuEmits>();

</script>

<template>
  <BaseContextMenu :x="menu.x" :y="menu.y">
    <TrackContextMenuMeta
      :album-label="menu.item.album || '本地下载'"
      :artist-label="menu.item.artist || '未知作者'"
      :source-id="menu.item.sourceId"
      :source-label="menu.item.sourceName"
    />
    <div class="context-menu-actions">
      <ContextMenuAction v-if="menu.item.status === 'failed'" @action="emit('retryDownload', menu.item)">
        <RotateCcw :size="16" />
        重试
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'paused'" @action="emit('resumeDownload', menu.item)">
        <PlayCircle :size="16" />
        继续
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'downloading'" @action="emit('pauseDownload', menu.item)">
        <PauseCircle :size="16" />
        暂停
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'downloaded'" :disabled="!menu.item.filePath" @action="emit('queueNext', menu.item)">
        <PlayCircle :size="16" />
        下一首播放
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'downloaded'" :disabled="!menu.item.filePath" @action="emit('addToPlaylist', menu.item)">
        <ListPlus :size="16" />
        添加到歌单
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'downloaded'" @action="emit('deleteDownload', menu.item)">
        <Trash2 :size="16" />
        删除本地下载
      </ContextMenuAction>
      <ContextMenuAction @action="emit('clearRecord', menu.item)">
        <XCircle :size="16" />
        清除记录
      </ContextMenuAction>
      <ContextMenuAction v-if="menu.item.status === 'downloaded'" :disabled="!menu.item.filePath" @action="emit('openFolder', menu.item)">
        <FolderOpen :size="16" />
        打开歌曲所在文件夹
      </ContextMenuAction>
    </div>
  </BaseContextMenu>
</template>
