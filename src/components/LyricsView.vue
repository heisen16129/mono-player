<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLyricsActionMenu } from '../composables/useLyricsActionMenu';
import { useLyricsAssociation } from '../composables/useLyricsAssociation';
import { useLyricsCover } from '../composables/useLyricsCover';
import { useLyricsDownload } from '../composables/useLyricsDownload';
import { useLyricsFullscreen } from '../composables/useLyricsFullscreen';
import { useLyricsHighlight } from '../composables/useLyricsHighlight';
import { useLyricsSearch } from '../composables/useLyricsSearch';
import { useLyricsScroll } from '../composables/useLyricsScroll';
import { useLyricsTrackLoader } from '../composables/useLyricsTrackLoader';
import type { LyricLine, Track, TrackLyrics } from '../types/music';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import LyricsActionMenu from './lyrics/LyricsActionMenu.vue';
import LyricsCoverPanel from './lyrics/LyricsCoverPanel.vue';
import LyricsHeaderBar from './lyrics/LyricsHeaderBar.vue';
import LyricsPanel from './lyrics/LyricsPanel.vue';
import LyricsSearchDialog from './lyrics/LyricsSearchDialog.vue';
import { normalizeTrackLyrics } from '../utils/trackLyrics';
import { trackIdentityKey } from '../utils/trackKey';

const props = defineProps<{
  activeTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  lyricFormat?: string | null;
  lyricsMetadata?: TrackLyrics | null;
  lyricsStatus?: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  lyricsError?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  coverChanged: [];
  lyricsCleared: [];
  lyricsFound: [
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    providerId?: string | null,
    trackId?: string | null,
    trackRaw?: unknown,
  ];
  notify: [message: string, variant?: 'success' | 'error'];
  seek: [time: number];
}>();

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
const activeLyrics = computed(() => props.lyricsMetadata ?? normalizeTrackLyrics(props.activeTrack));
const activeTrackRef = computed(() => props.activeTrack);
const isLyricsPending = computed(() => (
  !loadedLyricLines.value.length && (props.lyricsStatus === 'loading' || isLoadingLyrics.value)
));
const emptyLyricsMessage = computed(() => (
  props.lyricsStatus === 'error' ? props.lyricsError || '歌词加载失败' : t(player.settings.locale, 'noLyrics')
));
const hasAssociatedLyrics = computed(() => Boolean(props.activeTrack?.associatedLyrics?.lyrics.length));
const activeArtwork = computed(() => props.activeTrack?.associatedArtwork ?? props.activeTrack?.artwork ?? null);
const availableLyricFormats = computed(() => {
  const formats = activeLyrics.value?.lyrics.map((variant) => variant.format) ?? [];
  return formats.filter((format, index) => format && formats.indexOf(format) === index);
});
const downloadableLyricFormats = computed(() => {
  if (!hasAssociatedLyrics.value) return [];
  const formats = availableLyricFormats.value.length > 0
    ? availableLyricFormats.value
    : (activeLyrics.value?.lyrics[0] ? [activeLyrics.value.lyrics[0].format] : []);
  const items = formats.filter((format, index) => format && formats.indexOf(format) === index);
  if (items.includes('lrc') && !items.includes('txt')) {
    items.push('txt');
  }
  return items;
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
  onCoverChanged: () => emit('coverChanged'),
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
  lines: loadedLyricLines,
  lyricSearchStatus,
  lyricTrackKey,
  onLyricsCleared: () => emit('lyricsCleared'),
  onLyricsFound: (...args) => emit('lyricsFound', ...args),
  resolvingLyricTrackKey,
  scrollToActiveLyric,
  setArtworkCover,
});

const lyricsViewStyle = computed(() => ({
  '--lyrics-font-size': `${lyricFontSize.value}px`,
  '--smw-lyrics-current': player.settings.useThemeLyricColor ? undefined : player.settings.lyricFontColor,
  '--lyrics-cover-bg': backgroundCoverUrl.value ? `url("${backgroundCoverUrl.value}")` : undefined,
}));

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

async function closeLyricsView() {
  await closeFullscreenIfNeeded();
  emit('close');
}

async function openActionMenu(event: MouseEvent) {
  await updateFullscreenState();
  openFontMenu(event);
}

onMounted(() => {
  document.addEventListener('pointerdown', closeFontMenuOnOutsidePointer);
  void updateFullscreenState();
  void syncLyricsToCurrentTime();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFontMenuOnOutsidePointer);
  clearLyricsCoverCache();
});
</script>

<template>
  <section
    class="lyrics-view"
    :class="{ 'has-cover-background': backgroundCoverUrl }"
    :style="lyricsViewStyle"
    @contextmenu.prevent="openActionMenu"
  >
    <LyricsHeaderBar
      :album="activeTrack?.album || t(player.settings.locale, 'localMusic')"
      :artist="activeTrack?.artist || t(player.settings.locale, 'unknownArtist')"
      :close-label="t(player.settings.locale, 'close')"
      :title="activeTrack?.title || t(player.settings.locale, 'unknownTrack')"
      @close="closeLyricsView"
    />

    <div class="lyrics-stage">
      <LyricsCoverPanel :cover-url="displayCoverUrl" @error="handleCoverError" />

      <LyricsPanel
        :ref="setLyricsPanelRef"
        :active-lyric-index="activeLyricIndex"
        :empty-message="emptyLyricsMessage"
        :is-empty="!loadedLyricLines.length"
        :is-lyric-sync-open="isLyricSyncOpen"
        :is-lyrics-pending="isLyricsPending"
        :is-scrolling="isLyricsListScrolling"
        :label="t(player.settings.locale, 'lyrics')"
        :lines="loadedLyricLines"
        :loading-text="t(player.settings.locale, 'lyricsLoading')"
        :lyric-word-progress="lyricWordProgress"
        :scroll-thumb-top="scrollThumbTop"
        @begin-browse="beginLyricBrowse"
        @hide-scrollbar="hideLyricsScrollbar"
        @open-search="openLyricSearchDialog"
        @restore-realtime="restoreRealtimeLyrics"
        @scroll="syncScrollThumb"
        @seek="seekToLyric"
        @shift-timing="shiftLyricTiming"
        @wheel="handleLyricsWheel"
      />
    </div>

    <Teleport to="body">
      <LyricsActionMenu
        v-if="isFontMenuOpen"
        :downloadable-lyric-formats="downloadableLyricFormats"
        :font-size="lyricFontSize"
        :has-associated-lyrics="hasAssociatedLyrics"
        :has-downloadable-cover="hasDownloadableCover()"
        :has-linked-lyrics="Boolean(activeLyrics?.lyrics.length && activeTrack)"
        :is-fullscreen="isFullscreen"
        :left="fontMenuLeft"
        :linked-lyrics-label="activeTrack ? linkedLyricsLabel(activeTrack) : ''"
        :top="fontMenuTop"
        @clear-associated-lyrics="clearAssociatedLyrics"
        @decrease-font-size="decreaseLyricFontSize"
        @download-cover="downloadCover"
        @download-lyrics="downloadLyrics"
        @increase-font-size="increaseLyricFontSize"
        @open-lyric-search="openLyricSearchDialog"
        @open-lyric-sync="openLyricSyncControls"
        @toggle-fullscreen="toggleLyricsFullscreen(); closeFontMenu()"
      />
    </Teleport>

    <Teleport to="body">
      <LyricsSearchDialog
        v-if="isSearchDialogOpen"
        v-model:query="lyricSearchQuery"
        :is-loading-more="isLoadingMorePluginLyrics"
        :is-searching="isSearchingPluginLyrics"
        :provider-id="lyricSearchProviderId"
        :providers="lyricSearchProviders"
        :resolving-track-key="resolvingLyricTrackKey"
        :results="lyricSearchResults"
        :status="lyricSearchStatus"
        :tab-items="lyricProviderTabItems"
        :track-key="lyricTrackKey"
        @apply="applyPluginLyrics"
        @close="closeLyricSearchDialog"
        @scroll="handleLyricSearchResultsScroll"
        @search="searchPluginLyrics"
        @select-provider="selectLyricSearchProvider"
      />
    </Teleport>
  </section>
</template>

<style scoped>
.lyrics-view {
  position: relative;
  grid-row: 1;
  --lyrics-view-padding-x: clamp(28px, 5vw, 72px);
  min-height: 0;
  overflow: hidden;
  padding: 24px var(--lyrics-view-padding-x) 16px;
  background: var(--lyrics-surface, var(--smw-bg-canvas));
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
  opacity: 0.42;
}

.lyrics-view::after {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--smw-lyrics-bg) 58%, transparent) 0%,
      color-mix(in srgb, var(--smw-lyrics-bg) 42%, transparent) 48%,
      color-mix(in srgb, var(--smw-lyrics-bg) 68%, transparent) 100%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.48) 0%,
      transparent 56%,
      color-mix(in srgb, var(--smw-lyrics-bg) 18%, transparent) 100%
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

.lyrics-stage {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(520px, 1.7fr);
  gap: clamp(44px, 6vw, 86px);
  align-items: center;
  max-width: 1280px;
  height: calc(100% - 78px);
  margin: 0 auto;
}

.mono-window.lyrics-open .lyrics-stage {
  height: calc(100% - var(--player-height) - 78px);
}

</style>
