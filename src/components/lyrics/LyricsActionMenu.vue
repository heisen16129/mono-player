<script setup lang="ts">
defineProps<{
  downloadableLyricFormats: string[];
  fontSize: number;
  hasAssociatedLyrics: boolean;
  hasDownloadableCover: boolean;
  hasLinkedLyrics: boolean;
  isFullscreen: boolean;
  left: number;
  linkedLyricsLabel: string;
  top: number;
}>();

const emit = defineEmits<{
  clearAssociatedLyrics: [];
  decreaseFontSize: [];
  downloadCover: [];
  downloadLyrics: [format: string];
  increaseFontSize: [];
  openLyricSearch: [];
  openLyricSync: [];
  toggleFullscreen: [];
}>();
</script>

<template>
  <div
    class="lyrics-font-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="menu"
    aria-label="歌词操作"
    @contextmenu.prevent
    @pointerdown.stop
  >
    <span class="lyrics-font-menu-title">设置字号</span>
    <div class="lyrics-font-menu-row">
      <button type="button" aria-label="减小字号" @click="emit('decreaseFontSize')">
        A<small>-</small>
      </button>
      <strong>{{ fontSize }}</strong>
      <button type="button" aria-label="增大字号" @click="emit('increaseFontSize')">
        A<small>+</small>
      </button>
    </div>
    <span class="lyrics-menu-separator" aria-hidden="true"></span>
    <button class="lyrics-menu-item" type="button" disabled>操作</button>
    <button class="lyrics-menu-item" type="button" @click="emit('toggleFullscreen')">
      {{ isFullscreen ? '退出全屏' : '全屏显示' }}
    </button>
    <button class="lyrics-menu-item" type="button" :disabled="!hasDownloadableCover" @click="emit('downloadCover')">下载封面</button>
    <button
      v-for="format in downloadableLyricFormats"
      :key="format"
      class="lyrics-menu-item"
      type="button"
      @click="emit('downloadLyrics', format)"
    >
      下载歌词 (.{{ format }})
    </button>
    <span class="lyrics-menu-separator" aria-hidden="true"></span>
    <span v-if="hasLinkedLyrics" class="lyrics-menu-linked" :title="`已关联歌词：${linkedLyricsLabel}`">
      已关联歌词：{{ linkedLyricsLabel }}
    </span>
    <button class="lyrics-menu-item" type="button" @click="emit('openLyricSearch')">搜索歌词</button>
    <button class="lyrics-menu-item" type="button" @click="emit('openLyricSync')">同步歌词</button>
    <button v-if="hasAssociatedLyrics" class="lyrics-menu-item" type="button" @click="emit('clearAssociatedLyrics')">取消关联歌词</button>
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

.lyrics-font-menu-title {
  padding: 0 12px 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.lyrics-font-menu-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  gap: 10px;
  align-items: center;
  padding: 0 12px 10px;
}

.lyrics-font-menu-row button {
  display: inline-grid;
  height: 28px;
  place-items: center;
  border: 0;
  color: var(--smw-text-primary);
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.lyrics-font-menu-row button:hover {
  border-radius: 6px;
  background: var(--smw-bg-hover);
}

.lyrics-font-menu-row button small {
  margin-left: 1px;
  font-size: 10px;
}

.lyrics-font-menu-row strong {
  display: grid;
  height: 28px;
  place-items: center;
  border-radius: 5px;
  color: var(--smw-text-body);
  background: var(--smw-bg-selected);
  font-size: 13px;
  font-weight: 500;
}

.lyrics-menu-separator {
  display: block;
  height: 1px;
  margin: 6px 0;
  background: var(--smw-border-soft);
}

.lyrics-menu-item {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.lyrics-menu-item:hover,
.lyrics-menu-item:focus-visible {
  background: var(--smw-bg-hover);
  outline: none;
}

.lyrics-menu-item:disabled {
  color: var(--smw-text-muted);
  cursor: default;
  opacity: 0.58;
}

.lyrics-menu-item:disabled:hover {
  background: transparent;
}

.lyrics-menu-linked {
  display: block;
  min-width: 0;
  overflow: hidden;
  padding: 8px 12px;
  color: var(--smw-text-body);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
