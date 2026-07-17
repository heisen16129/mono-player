<script setup lang="ts">
import { Disc3, FolderOpen, IdCard, ListPlus, PauseCircle, PlayCircle, RotateCcw, Trash2, User, XCircle } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DownloadItem } from '../types/music';

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
</script>

<template>
  <div
    ref="menuRef"
    class="download-context-menu"
    :style="{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }"
    role="menu"
    @click.stop
    @contextmenu.prevent.stop
  >
    <div class="download-context-meta">
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
    <div class="download-context-actions">
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
  </div>
</template>

<style scoped>
.download-context-menu {
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

.download-context-menu button {
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

.download-context-menu button:hover:not(:disabled) {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.download-context-menu svg {
  color: var(--smw-icon-muted);
}

.download-context-menu button:disabled {
  cursor: default;
  opacity: 0.48;
}

.download-context-meta {
  display: grid;
  gap: 2px;
  padding: 4px 0 6px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.download-context-meta > div {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.download-context-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-context-actions {
  display: grid;
  gap: 2px;
  padding-top: 6px;
}
</style>
