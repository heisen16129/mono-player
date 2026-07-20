<script setup lang="ts">
import { Disc3, FolderOpen, IdCard, ListPlus, PauseCircle, PlayCircle, RotateCcw, Trash2, User, XCircle } from '@lucide/vue';
import type { DownloadItem } from '../types/music';
import BaseContextMenu from './BaseContextMenu.vue';

const props = defineProps<{
  menu: { item: DownloadItem; x: number; y: number };
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
}>();

</script>

<template>
  <BaseContextMenu :x="menu.x" :y="menu.y">
    <div class="context-menu-meta">
      <div>
        <IdCard :size="15" />
        <span>ID: {{ menu.item.sourceName }}@{{ menu.item.sourceId }}</span>
      </div>
      <div>
        <User :size="15" />
        <span>作者: {{ menu.item.artist || '未知作者' }}</span>
      </div>
      <div>
        <Disc3 :size="15" />
        <span>专辑: {{ menu.item.album || '本地下载' }}</span>
      </div>
    </div>
    <div class="context-menu-actions">
      <button v-if="menu.item.status === 'failed'" type="button" role="menuitem" @click="emit('retryDownload', menu.item)">
        <RotateCcw :size="16" />
        重试
      </button>
      <button v-if="menu.item.status === 'paused'" type="button" role="menuitem" @click="emit('resumeDownload', menu.item)">
        <PlayCircle :size="16" />
        继续
      </button>
      <button v-if="menu.item.status === 'downloading'" type="button" role="menuitem" @click="emit('pauseDownload', menu.item)">
        <PauseCircle :size="16" />
        暂停
      </button>
      <button v-if="menu.item.status === 'downloaded'" type="button" role="menuitem" :disabled="!menu.item.filePath" @click="emit('queueNext', menu.item)">
        <PlayCircle :size="16" />
        下一首播放
      </button>
      <button v-if="menu.item.status === 'downloaded'" type="button" role="menuitem" :disabled="!menu.item.filePath" @click="emit('addToPlaylist', menu.item)">
        <ListPlus :size="16" />
        添加到歌单
      </button>
      <button v-if="menu.item.status === 'downloaded'" type="button" role="menuitem" @click="emit('deleteDownload', menu.item)">
        <Trash2 :size="16" />
        删除本地下载
      </button>
      <button type="button" role="menuitem" @click="emit('clearRecord', menu.item)">
        <XCircle :size="16" />
        清除记录
      </button>
      <button v-if="menu.item.status === 'downloaded'" type="button" role="menuitem" :disabled="!menu.item.filePath" @click="emit('openFolder', menu.item)">
        <FolderOpen :size="16" />
        打开歌曲所在文件夹
      </button>
    </div>
  </BaseContextMenu>
</template>
