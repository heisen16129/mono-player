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
import { useLyricsRendererRuntime } from '../composables/useLyricsRendererRuntime';
import { useLyricsRendererSettings } from '../composables/useLyricsRendererSettings';
import { useWallpaperEngineBackground, retryWallpaperEngineBackground } from '../composables/useWallpaperEngineBackground';
import type { LyricsViewEmits, LyricsViewProps } from '../types/lyricsView';
import type { LyricLine } from '../types/music';
import type { LyricsRendererContext } from '../types/lyricsRenderer';
import { usePlayerStore } from '../stores/player';
import { setRustBackendVolume } from '../services/playerBackend';
import LyricsCollapseButton from './lyrics/LyricsCollapseButton.vue';
import LyricsHeaderBar from './lyrics/LyricsHeaderBar.vue';
import LyricsRendererHost from './lyrics/LyricsRendererHost.vue';
import { trackIdentityKey } from '../utils/trackKey';
import { artworkDisplaySrc, filePathToArtworkUrl } from '../utils/artwork';
import { useArtworkDominantColor } from '../composables/useArtworkDominantColor';

const props = defineProps<LyricsViewProps>();

const emit = defineEmits<LyricsViewEmits>();

const loadedLyricLines = ref<LyricLine[]>([]);
const rendererVolume = ref(72);
const isLoadingLyrics = ref(false);
const lyricsStageRef = ref<{ lyricsAnchorOffset: () => number | null } | null>(null);

const player = usePlayerStore();
const {
  activeRendererConfig,
  activeRendererId,
  hydrateLyricsRendererSettings,
  saveLyricsRendererConfig,
} = useLyricsRendererSettings();
const {
  activePlugin: activeLyricsRenderer,
  handleRendererError,
} = useLyricsRendererRuntime(activeRendererId);
const rendererOwnsSurface = computed(() => Boolean(activeLyricsRenderer.value?.ownsSurface));
const lyricsBackgroundSettings = computed(() => player.settings.lyricsBackground);
const wallpaperEngine = useWallpaperEngineBackground(lyricsBackgroundSettings, computed(() => props.isOpen));
const coverColorSource = computed(() => artworkDisplaySrc(
  props.activeTrack?.associatedArtwork || props.activeTrack?.artwork,
));
const coverDominantColor = useArtworkDominantColor(
  coverColorSource,
  computed(() => player.settings.lyricsBackground.source === 'color'
    && player.settings.lyricsBackground.colorMode === 'cover'
    && !player.settings.lyricsBackground.coverColor),
);
const rendererBackground = computed(() => {
  const background = player.settings.lyricsBackground;
  const waitingForScene = background.source === 'wallpaper' && background.wallpaperProjectType === 'scene'
    && !wallpaperEngine.sceneActive.value;
  const selectedMediaPath = background.source === 'wallpaper'
    ? (background.wallpaperProjectType === 'scene'
      ? (waitingForScene ? background.wallpaperPreviewPath : '')
      : (background.wallpaperMediaPath || background.wallpaperPreviewPath))
    : (background.source === 'media' ? background.mediaPath : '');
  const mediaUrl = selectedMediaPath
    ? artworkDisplaySrc(filePathToArtworkUrl(selectedMediaPath))
    : null;
  return {
    source: background.source,
    color: background.colorMode === 'cover'
      ? (background.coverColor || coverDominantColor.value || background.color)
      : background.color,
    mediaUrl: mediaUrl || null,
    mediaKind: background.source === 'wallpaper'
      ? (background.wallpaperProjectType === 'video' ? 'video' : 'image')
      : background.mediaKind,
    wallpaperProjectType: waitingForScene ? 'preview' : background.wallpaperProjectType,
    wallpaperFrameUrl: wallpaperEngine.frameUrl.value,
    opacity: background.opacity,
    blur: background.blur,
    windowOpacity: background.windowOpacity,
    positionX: background.positionX,
    positionY: background.positionY,
    scale: background.scale,
  };
});
void hydrateLyricsRendererSettings();
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
  onNotify: (message, variant) => emit('notify', message, variant),
  player,
});
const activeTrackIdentityKey = computed(() => trackIdentityKey(props.activeTrack));
const {
  backgroundCoverUrl,
  clearCoverState,
  clearLyricsCoverCache,
  displayCoverUrl,
  handleCoverError,
  prepareTrackCover,
  setArtworkCover,
} = useLyricsCover({
  activeArtwork,
  coverVersion: computed(() => props.activeTrack?.coverVersion),
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
  lyricFontSize,
  lyricTimeOffset,
  getAnchorOffset: () => lyricsStageRef.value?.lyricsAnchorOffset() ?? null,
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
  lyricFontSize,
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
  clearCoverState,
  isLoadingLyrics,
  isLyricSyncOpen,
  lyricFormat: computed(() => props.lyricFormat ?? null),
  lines: loadedLyricLines,
  lyricTimeOffset,
  prepareTrackCover,
  syncLyricsToCurrentTime,
});

const { lyricsRendererSearchDialog } = useLyricsViewPanelBindings({
  searchDialog: {
    apply: () => applyPluginLyrics,
    close: () => closeLyricSearchDialog,
    isLoadingMore: () => isLoadingMorePluginLyrics.value,
    isOpen: () => isSearchDialogOpen.value,
    isSearching: () => isSearchingPluginLyrics.value,
    providerId: () => lyricSearchProviderId.value,
    providers: () => lyricSearchProviders.value,
    query: () => lyricSearchQuery.value,
    resolvingTrackKey: () => resolvingLyricTrackKey.value,
    results: () => lyricSearchResults.value,
    scroll: () => handleLyricSearchResultsScroll,
    search: () => searchPluginLyrics,
    selectProvider: () => selectLyricSearchProvider,
    status: () => lyricSearchStatus.value,
    tabItems: () => lyricProviderTabItems.value,
    trackKey: () => lyricTrackKey,
    updateQuery: () => (value) => {
      lyricSearchQuery.value = value;
    },
  },
});

const lyricsRendererContext = computed<LyricsRendererContext>(() => ({
  actionMenu: {
    downloadableLyricFormats: downloadableLyricFormats.value,
    fontSize: lyricFontSize.value,
    hasAssociatedLyrics: hasAssociatedLyrics.value,
    hasDownloadableCover: hasDownloadableCover(),
    hasLinkedLyrics: Boolean(activeLyrics.value?.lyrics.length && props.activeTrack),
    isFullscreen: isFullscreen.value,
    isLyricSyncOpen: isLyricSyncOpen.value,
    isOpen: isFontMenuOpen.value,
    isPlayerDockHidden: props.isPlayerDockHidden,
    left: fontMenuLeft.value,
    linkedLyricsLabel: props.activeTrack ? linkedLyricsLabel(props.activeTrack) : '',
    top: fontMenuTop.value,
    close: closeFontMenu,
    clearAssociatedLyrics,
    closeLyricSync: closeLyricSyncControls,
    decreaseFontSize: decreaseLyricFontSize,
    downloadCover,
    downloadLyrics,
    increaseFontSize: increaseLyricFontSize,
    openLyricSearch: openLyricSearchDialog,
    openLyricSync: openLyricSyncControls,
    openSettings: () => emit('openSettings'),
    toggleFullscreen,
    togglePlayerDock: closeFontMenu,
  },
  searchDialog: lyricsRendererSearchDialog.value,
  lines: loadedLyricLines.value,
  currentTime: props.currentTime,
  isPlaying: props.isPlaying,
  isFavorite: props.isFavorite,
  activeLyricIndex: activeLyricIndex.value,
  lyricTimeOffset: lyricTimeOffset.value,
  fontSize: lyricFontSize.value,
  lyricColor: player.settings.lyricFontColor,
  useThemeLyricColor: player.settings.useThemeLyricColor,
  coverUrl: displayCoverUrl.value,
  background: rendererBackground.value,
  isLoading: isLyricsPending.value,
  emptyMessage: emptyLyricsMessage.value,
  loadingText: lyricsLoadingLabel.value,
  isPlayerDockHidden: props.isPlayerDockHidden,
  isLyricSyncOpen: isLyricSyncOpen.value,
  isScrolling: isLyricsListScrolling.value,
  scrollThumbTop: scrollThumbTop.value,
  label: lyricsLabel.value,
  title: titleLabel.value,
  artist: artistLabel.value,
  album: albumLabel.value,
  duration: props.activeTrack?.duration ?? null,
  volume: rendererVolume.value,
  config: activeRendererConfig.value,
  lyricWordProgress,
  seek: seekToLyric,
  beginBrowse: beginLyricBrowse,
  coverError: handleCoverError,
  hideScrollbar: hideLyricsScrollbar,
  openSearch: openLyricSearchDialog,
  restoreRealtime: restoreRealtimeLyrics,
  setLyricsPanelRef,
  syncScroll: syncScrollThumb,
  handleWheel: handleLyricsWheel,
  shiftTiming: shiftLyricTiming,
  close: () => emit('close'),
  togglePlayback: () => emit('togglePlayback'),
  playNext: () => emit('playNext'),
  playPrevious: () => emit('playPrevious'),
  toggleFavorite: () => emit('toggleFavorite'),
  seekToTime: (time) => emit('seek', time),
  setVolume: (value) => {
    rendererVolume.value = Math.min(100, Math.max(0, value));
    void setRustBackendVolume(rendererVolume.value / 100);
  },
  updateConfig: (config) => {
    saveLyricsRendererConfig(activeRendererId.value, config);
  },
  openActionMenu,
}));

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
} = useLyricsViewInteractions({
  clearLyricsCoverCache,
  closeFontMenu,
  closeFontMenuOnOutsidePointer,
  closeFullscreenIfNeeded,
  onClose: () => emit('close'),
  openFontMenu,
  syncLyricsToCurrentTime,
  toggleLyricsFullscreen,
  updateFullscreenState,
});

</script>

<template>
  <section
    class="lyrics-view"
    :class="{
      'has-cover-background': backgroundCoverUrl,
      'renderer-owns-surface': rendererOwnsSurface,
      'native-wallpaper-scene': rendererBackground.source === 'wallpaper' && rendererBackground.wallpaperProjectType === 'scene',
    }"
    :style="lyricsViewStyle"
  >
    <div class="lyrics-collapse-slot">
      <LyricsCollapseButton :label="closeLabel" @close="closeLyricsView" />
    </div>
    <div v-if="wallpaperEngine.error.value" class="wallpaper-error" role="alert">
      <span>{{ wallpaperEngine.error.value }}</span>
      <button type="button" @click="retryWallpaperEngineBackground">重试</button>
    </div>

    <div v-if="!rendererOwnsSurface" class="lyrics-header-slot">
      <LyricsHeaderBar
        :album="albumLabel"
        :artist="artistLabel"
        :title="titleLabel"
      />
    </div>

    <LyricsRendererHost
      ref="lyricsStageRef"
      v-if="activeLyricsRenderer"
      :context="lyricsRendererContext"
      :plugin="activeLyricsRenderer"
      :player-dock-controller="props.playerDockController"
      @error="handleRendererError"
    />

  </section>
</template>

<style scoped>
.wallpaper-error {
  position: absolute;
  z-index: 100;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 48px);
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--smw-bg-panel);
  color: var(--smw-text-body);
  font-size: 13px;
}
.wallpaper-error button { flex-shrink: 0; cursor: pointer; }
.wallpaper-error span { min-width: 0; overflow-wrap: anywhere; }
.lyrics-view {
  position: relative;
  grid-row: 1;
  --lyrics-view-padding-x: clamp(28px, 5vw, 72px);
  --lyrics-view-padding-top: 18px;
  min-height: 0;
  overflow: hidden;
  padding: var(--lyrics-view-padding-top) var(--lyrics-view-padding-x) 8px;
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

.lyrics-view.renderer-owns-surface {
  padding: 0;
  background: transparent;
}

.lyrics-view.native-wallpaper-scene {
  background: transparent;
}

.lyrics-view.renderer-owns-surface::before,
.lyrics-view.renderer-owns-surface::after {
  display: none;
}

.lyrics-view > *:not(.lyrics-header-slot):not(.lyrics-collapse-slot):not(.wallpaper-error) {
  position: relative;
  z-index: 1;
}

.lyrics-collapse-slot {
  position: absolute;
  inset: 16px 0 auto;
  z-index: 30;
  width: 100%;
  pointer-events: none;
}

.lyrics-header-slot {
  position: absolute;
  inset: 16px 0 auto;
  z-index: 20;
  width: 100%;
  display: grid;
  justify-items: center;
}

</style>

