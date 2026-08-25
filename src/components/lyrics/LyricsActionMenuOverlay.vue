<script setup lang="ts">
import LyricsActionMenu from './LyricsActionMenu.vue';

defineProps<{
  downloadableLyricFormats: string[];
  fontSize: number;
  hasAssociatedLyrics: boolean;
  hasDownloadableCover: boolean;
  hasLinkedLyrics: boolean;
  isFullscreen: boolean;
  isLyricSyncOpen: boolean;
  isOpen: boolean;
  isPlayerDockHidden: boolean;
  left: number;
  linkedLyricsLabel: string;
  top: number;
}>();

defineEmits<{
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
  <Teleport to="body">
    <LyricsActionMenu
      v-if="isOpen"
      :downloadable-lyric-formats="downloadableLyricFormats"
      :font-size="fontSize"
      :has-associated-lyrics="hasAssociatedLyrics"
      :has-downloadable-cover="hasDownloadableCover"
      :has-linked-lyrics="hasLinkedLyrics"
      :is-fullscreen="isFullscreen"
      :is-lyric-sync-open="isLyricSyncOpen"
      :is-player-dock-hidden="isPlayerDockHidden"
      :left="left"
      :linked-lyrics-label="linkedLyricsLabel"
      :top="top"
      @clear-associated-lyrics="$emit('clearAssociatedLyrics')"
      @close-lyric-sync="$emit('closeLyricSync')"
      @decrease-font-size="$emit('decreaseFontSize')"
      @download-cover="$emit('downloadCover')"
      @download-lyrics="$emit('downloadLyrics', $event)"
      @increase-font-size="$emit('increaseFontSize')"
      @toggle-player-dock="$emit('togglePlayerDock')"
      @open-lyric-search="$emit('openLyricSearch')"
      @open-lyric-sync="$emit('openLyricSync')"
      @open-settings="$emit('openSettings')"
      @toggle-fullscreen="$emit('toggleFullscreen')"
    />
  </Teleport>
</template>
