<script setup lang="ts">
import LyricsFontSizeControl from './LyricsFontSizeControl.vue';
import LyricsLinkedLyricsStatus from './LyricsLinkedLyricsStatus.vue';
import LyricsMenuItem from './LyricsMenuItem.vue';

defineProps<{
  downloadableLyricFormats: string[];
  fontSize: number;
  hasAssociatedLyrics: boolean;
  hasDownloadableCover: boolean;
  hasLinkedLyrics: boolean;
  isFullscreen: boolean;
  isLyricSyncOpen: boolean;
  isPlayerDockHidden: boolean;
  left: number;
  linkedLyricsLabel: string;
  top: number;
}>();

const emit = defineEmits<{
  clearAssociatedLyrics: [];
  closeLyricSync: [];
  decreaseFontSize: [];
  downloadCover: [];
  downloadLyrics: [format: string];
  increaseFontSize: [];
  openLyricSearch: [];
  openLyricSync: [];
  openSettings: [];
  toggleFullscreen: [];
  togglePlayerDock: [];
}>();
</script>

<template>
  <div
    class="lyrics-font-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="menu"
    aria-label="歌词操作"
    @contextmenu.prevent
    @click.stop
    @pointerdown.stop
  >
    <LyricsFontSizeControl :font-size="fontSize" @decrease="emit('decreaseFontSize')" @increase="emit('increaseFontSize')" />
    <span class="lyrics-menu-separator" aria-hidden="true"></span>
    <LyricsMenuItem disabled>操作</LyricsMenuItem>
    <LyricsMenuItem @select="emit('openSettings')">设置</LyricsMenuItem>
    <LyricsMenuItem @select="emit('toggleFullscreen')">
      {{ isFullscreen ? '退出全屏' : '全屏显示' }}
    </LyricsMenuItem>
    <LyricsMenuItem v-if="isLyricSyncOpen" @select="emit('closeLyricSync')">关闭同步</LyricsMenuItem>
    <LyricsMenuItem v-else @select="emit('openLyricSync')">同步歌词</LyricsMenuItem>
    <LyricsMenuItem @select="emit('togglePlayerDock')">
      {{ isPlayerDockHidden ? '显示播放栏' : '关闭播放栏' }}
    </LyricsMenuItem>
    <LyricsMenuItem v-if="hasDownloadableCover" @select="emit('downloadCover')">下载封面</LyricsMenuItem>
    <LyricsMenuItem
      v-for="format in downloadableLyricFormats"
      :key="format"
      @select="emit('downloadLyrics', format)"
    >
      下载歌词 (.{{ format }})
    </LyricsMenuItem>
    <span class="lyrics-menu-separator" aria-hidden="true"></span>
    <LyricsLinkedLyricsStatus v-if="hasLinkedLyrics" :label="linkedLyricsLabel" />
    <LyricsMenuItem @select="emit('openLyricSearch')">搜索歌词</LyricsMenuItem>
    <LyricsMenuItem v-if="hasAssociatedLyrics" @select="emit('clearAssociatedLyrics')">取消关联歌词</LyricsMenuItem>
  </div>
</template>

<style scoped>
.lyrics-font-menu {
  position: fixed;
  z-index: 40;
  display: grid;
  gap: 0;
  width: 204px;
  padding: 8px 0;
  border: 1px solid var(--smw-border);
  border-radius: 6px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
}

.lyrics-menu-separator {
  display: block;
  height: 1px;
  margin: 6px 0;
  background: var(--smw-border-soft);
}
</style>
