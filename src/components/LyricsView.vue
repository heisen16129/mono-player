<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLyricsActionMenu } from '../composables/useLyricsActionMenu';
import { useLyricsAssociation } from '../composables/useLyricsAssociation';
import { useLyricsCover } from '../composables/useLyricsCover';
import { useLyricsDownload } from '../composables/useLyricsDownload';
import { useLyricsFullscreen } from '../composables/useLyricsFullscreen';
import { useLyricsHighlight } from '../composables/useLyricsHighlight';
import { useLyricsMetadataState } from '../composables/useLyricsMetadataState';
import { useLyricsSearch } from '../composables/useLyricsSearch';
import { useLyricsScroll } from '../composables/useLyricsScroll';
import { useLyricsTrackLoader } from '../composables/useLyricsTrackLoader';
import { useLyricsViewPanelBindings } from '../composables/useLyricsViewPanelBindings';
import { useLyricsViewLabels } from '../composables/useLyricsViewLabels';
import { useLyricsViewInteractions } from '../composables/useLyricsViewInteractions';
import { useLyricsViewStyle } from '../composables/useLyricsViewStyle';
import type { LyricsViewEmits, LyricsViewProps } from '../types/lyricsView';
import type { LyricLine } from '../types/music';
import { usePlayerStore } from '../stores/player';
import LyricsActionMenuOverlay from './lyrics/LyricsActionMenuOverlay.vue';
import LyricsHeaderBar from './lyrics/LyricsHeaderBar.vue';
import LyricsSearchDialogOverlay from './lyrics/LyricsSearchDialogOverlay.vue';
import LyricsStage from './lyrics/LyricsStage.vue';
import { trackIdentityKey } from '../utils/trackKey';

const props = defineProps<LyricsViewProps>();

const emit = defineEmits<LyricsViewEmits>();

const loadedLyricLines = ref<LyricLine[]>([]);
const isLoadingLyrics = ref(false);

const player = usePlayerStore();
const {
  closeFullscreenIfNeeded,
  isFullscreen,
  toggleLyricsFullscreen,
  updateFullscreenState,
} = useLyricsFullscreen();
const lyricFontSize = computed(() => player.settings.lyricFontSize);
const {
  closeFontMenu,
  closeFontMenuOnOutsidePointer,
  closeLyricSyncControls,
  decreaseLyricFontSize,
  fontMenuLeft,
  fontMenuTop,
  increaseLyricFontSize,
  isFontMenuOpen,
  isLyricSyncOpen,
  lyricTimeOffset,
  openFontMenu,
  openLyricSyncControls,
  shiftLyricTiming,
} = useLyricsActionMenu({
  getFontSize: () => lyricFontSize.value,
  scrollToActiveLyric: () => scrollToActiveLyric(),
  setFontSize: (size) => player.setLyricFontSize(size),
});
const {
  closeLyricSearchDialog,
  handleLyricSearchResultsScroll,
  isLoadingMorePluginLyrics,
  isSearchDialogOpen,
  isSearchingPluginLyrics,
  lyricProviderTabItems,
  lyricSearchProviderId,
  lyricSearchProviders,
  lyricSearchQuery,
  lyricSearchResults,
  lyricSearchStatus,
  lyricTrackKey,
  openLyricSearchDialog,
  resolvingLyricTrackKey,
  searchPluginLyrics,
  selectLyricSearchProvider,
} = useLyricsSearch({
  defaultQuery: () => [props.activeTrack?.title, props.activeTrack?.artist].filter(Boolean).join(' ').trim(),
  beforeOpen: closeFontMenu,
});
const activeTrackRef = computed(() => props.activeTrack);
const {
  activeArtwork,
  activeLyrics,
  availableLyricFormats,
  downloadableLyricFormats,
  emptyLyricsMessage,
  hasAssociatedLyrics,
  isLyricsPending,
} = useLyricsMetadataState({
  activeTrack: activeTrackRef,
  isLoadingLyrics,
  lines: loadedLyricLines,
  locale: () => player.settings.locale,
  lyricsError: () => props.lyricsError,
  lyricsMetadata: () => props.lyricsMetadata,
  lyricsStatus: () => props.lyricsStatus,
});
const {
  downloadCover,
  downloadLyrics,
  hasDownloadableCover,
  linkedLyricsLabel,
} = useLyricsDownload({
  activeLyricFormats: availableLyricFormats,
  activeLyrics,
  activeTrack: activeTrackRef,
  closeMenu: closeFontMenu,
  onCoverChanged: (artwork) => emit('coverChanged', artwork),
  onNotify: (message, variant) => emit('notify', message, variant),
  player,
});
const activeTrackIdentityKey = computed(() => trackIdentityKey(props.activeTrack));
const {
  applyCover,
  backgroundCoverUrl,
  clearCoverState,
  clearLyricsCoverCache,
  displayCoverUrl,
  handleCoverError,
  hasLyricsCoverCache,
  isActiveCoverDisplayed,
  loadLyricsCover,
  loadLyricsCoverThumbnail,
  prepareTrackCover,
  setArtworkCover,
} = useLyricsCover({
  activeArtwork,
  activeTrack: activeTrackRef,
  activeTrackIdentityKey,
});

const {
  activeLyricIndex,
  lyricWordProgress,
} = useLyricsHighlight({
  currentTime: computed(() => props.currentTime),
  isPlaying: computed(() => props.isPlaying),
  lines: loadedLyricLines,
  lyricTimeOffset,
});
const {
  beginLyricBrowse,
  handleLyricsWheel,
  hideLyricsScrollbar,
  isLyricsListScrolling,
  restoreRealtimeLyrics,
  scrollThumbTop,
  scrollToActiveLyric,
  seekToLyric,
  setLyricsPanelRef,
  syncLyricsToCurrentTime,
  syncScrollThumb,
} = useLyricsScroll({
  activeLyricIndex,
  isLoadingLyrics,
  lines: loadedLyricLines,
  lyricTimeOffset,
  onSeek: (time) => emit('seek', time),
});
const {
  applyPluginLyrics,
  clearAssociatedLyrics,
} = useLyricsAssociation({
  activeTrack: activeTrackRef,
  clearCoverState,
  closeFontMenu,
  closeLyricSearchDialog,
  lyricSearchStatus,
  lyricTrackKey,
  onLyricsCleared: () => emit('lyricsCleared'),
  onLyricsFound: (...args) => emit('lyricsFound', ...args),
  resolvingLyricTrackKey,
  setArtworkCover,
});

const { lyricsViewStyle } = useLyricsViewStyle({
  backgroundCoverUrl,
  lyricFontColor: () => player.settings.lyricFontColor,
  lyricFontSize,
  useThemeLyricColor: () => player.settings.useThemeLyricColor,
});
const {
  albumLabel,
  artistLabel,
  closeLabel,
  lyricsLabel,
  lyricsLoadingLabel,
  titleLabel,
} = useLyricsViewLabels({
  activeTrack: activeTrackRef,
  locale: () => player.settings.locale,
});

useLyricsTrackLoader({
  activeArtwork,
  activeLyrics,
  activeTrack: activeTrackRef,
  activeTrackIdentityKey,
  applyCover,
  clearCoverState,
  hasLyricsCoverCache,
  isActiveCoverDisplayed,
  isLoadingLyrics,
  isLyricSyncOpen,
  lyricFormat: computed(() => props.lyricFormat ?? null),
  lines: loadedLyricLines,
  loadLyricsCover,
  loadLyricsCoverThumbnail,
  lyricTimeOffset,
  prepareTrackCover,
  syncLyricsToCurrentTime,
});

async function syncLyricsAfterOpen() {
  await syncLyricsToCurrentTime();
  requestAnimationFrame(() => {
    void syncLyricsToCurrentTime();
    requestAnimationFrame(() => {
      void syncLyricsToCurrentTime();
    });
  });
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    void syncLyricsAfterOpen();
  },
  { flush: 'post' },
);

const {
  closeLyricsView,
  openActionMenu,
  toggleFullscreen,
  togglePlayerDock,
} = useLyricsViewInteractions({
  clearLyricsCoverCache,
  closeFontMenu,
  closeFontMenuOnOutsidePointer,
  closeFullscreenIfNeeded,
  isPlayerDockHidden: () => props.isPlayerDockHidden,
  onClose: () => emit('close'),
  onHidePlayerDock: () => emit('hidePlayerDock'),
  onShowPlayerDock: () => emit('showPlayerDock'),
  openFontMenu,
  syncLyricsToCurrentTime,
  toggleLyricsFullscreen,
  updateFullscreenState,
});

const {
  lyricsActionMenuProps,
  lyricsSearchDialogProps,
  lyricsStageProps,
} = useLyricsViewPanelBindings({
  stage: {
    activeLyricIndex: () => activeLyricIndex.value,
    coverUrl: () => displayCoverUrl.value,
    emptyMessage: () => emptyLyricsMessage.value,
    isEmpty: () => !loadedLyricLines.value.length,
    isLyricSyncOpen: () => isLyricSyncOpen.value,
    isLyricsPending: () => isLyricsPending.value,
    isScrolling: () => isLyricsListScrolling.value,
    label: () => lyricsLabel.value,
    lines: () => loadedLyricLines.value,
    loadingText: () => lyricsLoadingLabel.value,
    lyricWordProgress: () => lyricWordProgress,
    scrollThumbTop: () => scrollThumbTop.value,
    setLyricsPanelRef: () => setLyricsPanelRef,
  },
  actionMenu: {
    downloadableLyricFormats: () => downloadableLyricFormats.value,
    fontSize: () => lyricFontSize.value,
    hasAssociatedLyrics: () => hasAssociatedLyrics.value,
    hasDownloadableCover: () => hasDownloadableCover(),
    hasLinkedLyrics: () => Boolean(activeLyrics.value?.lyrics.length && props.activeTrack),
    isFullscreen: () => isFullscreen.value,
    isLyricSyncOpen: () => isLyricSyncOpen.value,
    isOpen: () => isFontMenuOpen.value,
    isPlayerDockHidden: () => props.isPlayerDockHidden,
    left: () => fontMenuLeft.value,
    linkedLyricsLabel: () => (props.activeTrack ? linkedLyricsLabel(props.activeTrack) : ''),
    top: () => fontMenuTop.value,
  },
  searchDialog: {
    isLoadingMore: () => isLoadingMorePluginLyrics.value,
    isOpen: () => isSearchDialogOpen.value,
    isSearching: () => isSearchingPluginLyrics.value,
    providerId: () => lyricSearchProviderId.value,
    providers: () => lyricSearchProviders.value,
    resolvingTrackKey: () => resolvingLyricTrackKey.value,
    results: () => lyricSearchResults.value,
    status: () => lyricSearchStatus.value,
    tabItems: () => lyricProviderTabItems.value,
    trackKey: () => lyricTrackKey,
  },
});
</script>

<template>
  <section
    class="lyrics-view"
    :class="{
      'has-cover-background': backgroundCoverUrl,
    }"
    :style="lyricsViewStyle"
    @contextmenu.prevent="openActionMenu"
  >
    <LyricsHeaderBar
      :album="albumLabel"
      :artist="artistLabel"
      :close-label="closeLabel"
      :title="titleLabel"
      @close="closeLyricsView"
    />

    <LyricsStage
      v-bind="lyricsStageProps"
      @begin-browse="beginLyricBrowse"
      @cover-error="handleCoverError"
      @hide-scrollbar="hideLyricsScrollbar"
      @open-search="openLyricSearchDialog"
      @restore-realtime="restoreRealtimeLyrics"
      @scroll="syncScrollThumb"
      @seek="seekToLyric"
      @shift-timing="shiftLyricTiming"
      @wheel="handleLyricsWheel"
    />

    <LyricsActionMenuOverlay
      v-bind="lyricsActionMenuProps"
      @clear-associated-lyrics="clearAssociatedLyrics"
      @close-lyric-sync="closeLyricSyncControls"
      @decrease-font-size="decreaseLyricFontSize"
      @download-cover="downloadCover"
      @download-lyrics="downloadLyrics"
      @increase-font-size="increaseLyricFontSize"
      @toggle-player-dock="togglePlayerDock"
      @open-lyric-search="openLyricSearchDialog"
      @open-lyric-sync="openLyricSyncControls"
      @toggle-fullscreen="toggleFullscreen"
    />

    <LyricsSearchDialogOverlay
      v-model:query="lyricSearchQuery"
      v-bind="lyricsSearchDialogProps"
      @apply="applyPluginLyrics"
      @close="closeLyricSearchDialog"
      @scroll="handleLyricSearchResultsScroll"
      @search="searchPluginLyrics"
      @select-provider="selectLyricSearchProvider"
    />
  </section>
</template>

<style scoped>
.lyrics-view {
  position: relative;
  grid-row: 1;
  --lyrics-view-padding-x: clamp(28px, 5vw, 72px);
  --lyrics-view-padding-top: 24px;
  min-height: 0;
  overflow: hidden;
  padding: var(--lyrics-view-padding-top) var(--lyrics-view-padding-x) 16px;
  background: var(--smw-lyrics-bg, var(--smw-bg-canvas));
}

.lyrics-view.has-cover-background {
  background-image: var(--lyrics-cover-bg);
  background-position: center;
  background-size: cover;
}

.lyrics-view::before,
.lyrics-view::after {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
}

.lyrics-view::before {
  inset: -18px;
  background-image: var(--lyrics-cover-bg);
  background-position: center;
  background-size: cover;
  filter: blur(16px) saturate(0.82) brightness(1.02);
  opacity: 0;
  transform: scale(1.02);
}

.lyrics-view.has-cover-background::before {
  opacity: 1;
}

.lyrics-view::after {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--smw-lyrics-bg) 82%, transparent) 0%,
      color-mix(in srgb, var(--smw-lyrics-bg) 68%, transparent) 48%,
      color-mix(in srgb, var(--smw-lyrics-bg) 88%, transparent) 100%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.54) 0%,
      color-mix(in srgb, var(--smw-lyrics-bg) 24%, transparent) 56%,
      color-mix(in srgb, var(--smw-lyrics-bg) 42%, transparent) 100%
  );
  opacity: 0;
}

.lyrics-view.has-cover-background::after {
  opacity: 0.82;
}

.lyrics-view > * {
  position: relative;
  z-index: 1;
}

</style>

