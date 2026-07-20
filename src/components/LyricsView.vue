<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronDown, Maximize2, Minimize2, Music } from '@lucide/vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useLyricsDownload } from '../composables/useLyricsDownload';
import { useLyricsSearch } from '../composables/useLyricsSearch';
import { useScrollingState } from '../composables/useScrollingState';
import { readCover, readCoverThumbnail, resolveLyricsSource } from '../services/music';
import type { LyricLine, Track } from '../types/music';
import { isTauriRuntime } from '../services/music';
import { getPluginLyricsMetadata } from '../services/pluginSearch';
import { t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { PluginSearchTrack } from '../types/plugin';
import { artworkDisplaySrc, coverImageObjectUrl, isTemporaryObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';
import BaseDialog from './BaseDialog.vue';
import DefaultCover from './DefaultCover.vue';
import EmptyState from './EmptyState.vue';
import SegmentTabs from './SegmentTabs.vue';
import SearchInput from './SearchInput.vue';
import { getErrorMessage } from '../utils/error';
import { parseRawLyrics } from '../utils/lyrics';
import { getPlayerOriginalCoverCache, playerCoverCacheKey } from '../services/playerCoverCache';
import { normalizeTrackLyrics } from '../utils/trackLyrics';
import { trackIdentityKey } from '../utils/trackKey';

const MAX_LYRICS_COVER_CACHE = 80;
const lyricsCoverCache = new Map<string, { url: string; data: number[] | null; mimeType: string | null }>();
const lyricsCoverRequestCache = new Map<string, Promise<{ url: string; data: number[] | null; mimeType: string | null } | null>>();
const failedArtworkUrls = new Set<string>();
const componentCoverRefs = new Map<string, number>();
let lyricsCoverCacheVersion = 0;

const props = defineProps<{
  activeTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  lyricsStatus?: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  lyricsError?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  coverChanged: [];
  lyricsCleared: [];
  lyricsFound: [
    rawLyrics: string,
    artwork?: string | null,
    sourceName?: string | null,
    sourceUrl?: string | null,
    formats?: string[],
    defaultFormat?: string | null,
    format?: string | null,
    providerId?: string | null,
    trackId?: string | null,
    trackRaw?: unknown,
  ];
  notify: [message: string, variant?: 'success' | 'error'];
  seek: [time: number];
}>();

const loadedLyricLines = ref<LyricLine[]>([]);
const lyricsPanel = ref<HTMLElement | null>(null);
const isLoadingLyrics = ref(false);
const isBrowsingLyrics = ref(false);
const { hideScrolling: hideLyricsListScrolling, isScrolling: isLyricsListScrolling, showScrolling: showLyricsListScrolling } = useScrollingState();
const scrollThumbTop = ref(0);
const coverUrl = ref('');
const coverData = ref<number[] | null>(null);
const coverMimeType = ref<string | null>(null);
const activeCoverCacheKey = ref<string | null>(null);
const isFontMenuOpen = ref(false);
const isFullscreen = ref(false);
const isLyricSyncOpen = ref(false);
const lyricTimeOffset = ref(0);
const fontMenuLeft = ref(0);
const fontMenuTop = ref(0);
const smoothCurrentTime = ref(0);
let browseRestoreTimer = 0;
let lyricAnimationFrame = 0;
let lastLyricFrameAt = 0;
let lyricsLoadRequestId = 0;
let restoreMaximizedAfterFullscreen = false;

const MIN_LYRIC_FONT_SIZE = 14;
const MAX_LYRIC_FONT_SIZE = 34;
const player = usePlayerStore();
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
  defaultQuery: defaultLyricSearchQuery,
  beforeOpen: closeFontMenu,
});
const lyricFontSize = computed(() => player.settings.lyricFontSize);
const syncedLyricTime = computed(() => smoothCurrentTime.value + lyricTimeOffset.value);
const activeLyrics = computed(() => normalizeTrackLyrics(props.activeTrack));
const activeTrackRef = computed(() => props.activeTrack);
const isLyricsPending = computed(() => (
  !loadedLyricLines.value.length && (props.lyricsStatus === 'loading' || isLoadingLyrics.value)
));
const emptyLyricsMessage = computed(() => (
  props.lyricsStatus === 'error' ? props.lyricsError || '歌词加载失败' : t(player.settings.locale, 'noLyrics')
));
const hasAssociatedLyrics = computed(() => Boolean(props.activeTrack?.associatedLyrics?.rawLyrics?.trim()));
const activeArtwork = computed(() => props.activeTrack?.associatedArtwork ?? props.activeTrack?.artwork ?? null);
const availableLyricFormats = computed(() => {
  const formats = activeLyrics.value?.formats ?? [];
  return formats.filter((format, index) => format && formats.indexOf(format) === index);
});
const downloadableLyricFormats = computed(() => {
  if (!hasAssociatedLyrics.value) return [];
  const formats = availableLyricFormats.value.length > 0
    ? availableLyricFormats.value
    : (activeLyrics.value?.rawLyrics ? [activeLyrics.value.format ?? 'lrc'] : []);
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

function resolveRawLyrics(rawLyrics: string, format?: string | null) {
  return resolveLyricsSource({
    rawLyrics,
    lyricsFormat: format ?? null,
  });
}

function normalizeLyricLines(lines: LyricLine[]) {
  return lines.filter((line) => {
    const text = line.text.trim();
    return text && text !== '...' && text !== '…';
  });
}

const activeLyricIndex = computed(() => {
  let timedIndex = -1;
  for (let index = 0; index < loadedLyricLines.value.length; index += 1) {
    const line = loadedLyricLines.value[index];
    if (line.time !== null && line.time <= syncedLyricTime.value) {
      timedIndex = index;
    }
  }

  if (timedIndex >= 0) return timedIndex;
  return loadedLyricLines.value.length > 0 ? 0 : -1;
});

function activeLyricWordIndex(line: LyricLine, currentTime = syncedLyricTime.value) {
  if (!line.words?.length) return -1;

  let activeIndex = -1;
  for (let index = 0; index < line.words.length; index += 1) {
    if (line.words[index].time <= currentTime) {
      activeIndex = index;
    }
  }
  return activeIndex;
}

function nextLyricBoundary(lineIndex: number, wordIndex: number) {
  const line = loadedLyricLines.value[lineIndex];
  const nextWordTime = line?.words?.[wordIndex + 1]?.time;
  if (typeof nextWordTime === 'number') return nextWordTime;

  for (let index = lineIndex + 1; index < loadedLyricLines.value.length; index += 1) {
    const nextLineTime = loadedLyricLines.value[index].time;
    if (nextLineTime !== null) return nextLineTime;
  }

  const wordTime = line?.words?.[wordIndex]?.time ?? line?.time ?? syncedLyricTime.value;
  return wordTime + 0.45;
}

function lyricWordProgress(line: LyricLine, lineIndex: number, wordIndex: number) {
  if (!line.words?.length || lineIndex !== activeLyricIndex.value) return '0%';

  const currentTime = syncedLyricTime.value;
  const word = line.words[wordIndex];
  if (currentTime < word.time) return '0%';

  const activeWordIndex = activeLyricWordIndex(line, currentTime);
  if (wordIndex < activeWordIndex) return '100%';
  if (wordIndex > activeWordIndex) return '0%';

  const duration = Math.max(0.08, nextLyricBoundary(lineIndex, wordIndex) - word.time);
  const progress = Math.min(1, Math.max(0, (currentTime - word.time) / duration));
  return `${Math.round(progress * 1000) / 10}%`;
}

function tickLyricAnimation(now: number) {
  if (lastLyricFrameAt === 0) {
    lastLyricFrameAt = now;
  }

  if (props.isPlaying) {
    const elapsed = Math.min(0.25, Math.max(0, (now - lastLyricFrameAt) / 1000));
    smoothCurrentTime.value += elapsed;
  } else {
    smoothCurrentTime.value = props.currentTime;
  }

  lastLyricFrameAt = now;
  lyricAnimationFrame = window.requestAnimationFrame(tickLyricAnimation);
}

const displayCoverUrl = computed(() => {
  if (coverUrl.value) return coverUrl.value;

  const path = props.activeTrack?.path;
  const identityKey = activeTrackIdentityKey.value;
  if (!path || !identityKey) return '';

  const artwork = activeArtwork.value;
  const coverVersion = props.activeTrack.coverVersion;
  const fullCover = lyricsCoverCache.get(lyricsCoverCacheKey(identityKey, artwork, coverVersion));
  if (fullCover?.url) return fullCover.url;

  return lyricsCoverCache.get(lyricsCoverThumbCacheKey(identityKey, artwork, coverVersion))?.url ?? '';
});

const backgroundCoverUrl = computed(() => {
  return displayCoverUrl.value || getPlayerOriginalCoverCache(playerCoverCacheKey(props.activeTrack))?.url || '';
});

const lyricsViewStyle = computed(() => ({
  '--lyrics-font-size': `${lyricFontSize.value}px`,
  '--smw-lyrics-current': player.settings.useThemeLyricColor ? undefined : player.settings.lyricFontColor,
  '--lyrics-cover-bg': backgroundCoverUrl.value ? `url("${backgroundCoverUrl.value}")` : undefined,
}));

function lyricsCoverCacheKey(path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
  return `${path}:${artwork ?? ''}:${coverVersion ?? ''}:full`;
}

function lyricsCoverThumbCacheKey(path: string, artwork: string | null | undefined, coverVersion: number | undefined) {
  return `${path}:${artwork ?? ''}:${coverVersion ?? ''}:thumb`;
}

function retainLyricsCoverCache(key: string | null) {
  if (!key) return;
  componentCoverRefs.set(key, (componentCoverRefs.get(key) ?? 0) + 1);
}

function releaseLyricsCoverCache(key: string | null) {
  if (!key) return;
  const refs = (componentCoverRefs.get(key) ?? 0) - 1;
  if (refs > 0) {
    componentCoverRefs.set(key, refs);
    return;
  }

  componentCoverRefs.delete(key);
}

function trimLyricsCoverCache() {
  while (lyricsCoverCache.size > MAX_LYRICS_COVER_CACHE) {
    const entry = lyricsCoverCache.entries().next().value;
    if (!entry) return;
    const [key, cached] = entry;
    if (componentCoverRefs.has(key)) return;
    lyricsCoverCache.delete(key);
    revokeTemporaryObjectUrl(cached.url);
  }
}

function setLyricsCoverCache(key: string, value: { url: string; data: number[] | null; mimeType: string | null }) {
  lyricsCoverCache.delete(key);
  lyricsCoverCache.set(key, value);
  trimLyricsCoverCache();
}

function deleteLyricsCoverCache(key: string | null) {
  if (!key) return;
  const cached = lyricsCoverCache.get(key);
  lyricsCoverCache.delete(key);
  componentCoverRefs.delete(key);
  revokeTemporaryObjectUrl(cached?.url);
}

function clearLyricsCoverCache() {
  lyricsCoverCacheVersion += 1;
  for (const cached of lyricsCoverCache.values()) {
    revokeTemporaryObjectUrl(cached.url);
  }
  lyricsCoverCache.clear();
  lyricsCoverRequestCache.clear();
  componentCoverRefs.clear();
}

async function loadLyricsCover(path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource = path) {
  const key = lyricsCoverCacheKey(cacheSource, artwork, coverVersion);
  const cached = lyricsCoverCache.get(key);
  if (cached) return { key, cover: cached };

  const existingRequest = lyricsCoverRequestCache.get(key);
  if (existingRequest) return { key, cover: await existingRequest };

  const requestCacheVersion = lyricsCoverCacheVersion;
  const request = (async () => {
    const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    if (artworkUrl) {
      return { url: artworkUrl, data: null, mimeType: null };
    }

    const cover = await readCover(path);
    const url = coverImageObjectUrl(cover);
    if (!cover?.data.length || !url) return null;
    return {
      url,
      data: cover.data,
      mimeType: cover.mime_type,
    };
  })()
    .then((cover) => {
      if (requestCacheVersion !== lyricsCoverCacheVersion) {
        revokeTemporaryObjectUrl(cover?.url);
        return null;
      }
      if (cover) setLyricsCoverCache(key, cover);
      return cover;
    })
    .finally(() => {
      lyricsCoverRequestCache.delete(key);
    });

  lyricsCoverRequestCache.set(key, request);
  return { key, cover: await request };
}

async function loadLyricsCoverThumbnail(path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource = path) {
  const key = lyricsCoverThumbCacheKey(cacheSource, artwork, coverVersion);
  const cached = lyricsCoverCache.get(key);
  if (cached) return { key, cover: cached };

  const existingRequest = lyricsCoverRequestCache.get(key);
  if (existingRequest) return { key, cover: await existingRequest };

  const requestCacheVersion = lyricsCoverCacheVersion;
  const request = (async () => {
    const artworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    if (artworkUrl) {
      return { url: artworkUrl, data: null, mimeType: null };
    }

    const cover = await readCoverThumbnail(path);
    const url = coverImageObjectUrl(cover);
    if (!cover?.data.length || !url) return null;
    return {
      url,
      data: null,
      mimeType: cover.mime_type,
    };
  })()
    .then((cover) => {
      if (requestCacheVersion !== lyricsCoverCacheVersion) {
        revokeTemporaryObjectUrl(cover?.url);
        return null;
      }
      if (cover) setLyricsCoverCache(key, cover);
      return cover;
    })
    .finally(() => {
      lyricsCoverRequestCache.delete(key);
    });

  lyricsCoverRequestCache.set(key, request);
  return { key, cover: await request };
}

watch(
  () => [activeTrackIdentityKey.value, props.activeTrack?.path, props.activeTrack?.title, props.activeTrack?.artist, activeArtwork.value, activeLyrics.value?.rawLyrics, activeLyrics.value?.lyricsUrl, activeLyrics.value?.format, props.activeTrack?.coverVersion] as const,
  async ([identityKey, path, _title, _artist, artwork, rawLyrics, _lyricsUrl, _format, coverVersion]) => {
    const requestId = ++lyricsLoadRequestId;
    lyricTimeOffset.value = 0;
    isLyricSyncOpen.value = false;
    const previousCoverCacheKey = activeCoverCacheKey.value;
    activeCoverCacheKey.value = null;
    if (!identityKey || !path) {
      releaseLyricsCoverCache(previousCoverCacheKey);
      loadedLyricLines.value = [];
      coverUrl.value = '';
      coverData.value = null;
      coverMimeType.value = null;
      return;
    }

    const usableArtworkUrl = usableArtworkDisplaySrc(artwork, failedArtworkUrls);
    const playerCoverCache = usableArtworkUrl ? null : getPlayerOriginalCoverCache(playerCoverCacheKey(props.activeTrack));
    const nextCoverCacheKey = lyricsCoverCacheKey(identityKey, artwork, coverVersion);
    const nextThumbCacheKey = lyricsCoverThumbCacheKey(identityKey, artwork, coverVersion);
    const cachedCover = playerCoverCache ?? lyricsCoverCache.get(nextCoverCacheKey) ?? lyricsCoverCache.get(nextThumbCacheKey);
    const cachedCoverKey = lyricsCoverCache.has(nextCoverCacheKey) ? nextCoverCacheKey : nextThumbCacheKey;
    if (usableArtworkUrl) {
      releaseLyricsCoverCache(previousCoverCacheKey);
      coverUrl.value = usableArtworkUrl;
      coverData.value = null;
      coverMimeType.value = null;
    } else if (cachedCover) {
      if (!playerCoverCache) retainLyricsCoverCache(cachedCoverKey);
      releaseLyricsCoverCache(previousCoverCacheKey);
      activeCoverCacheKey.value = playerCoverCache ? null : cachedCoverKey;
      coverUrl.value = cachedCover.url;
      coverData.value = cachedCover.data;
      coverMimeType.value = cachedCover.mimeType;
    } else {
      releaseLyricsCoverCache(previousCoverCacheKey);
      coverUrl.value = '';
      coverData.value = null;
      coverMimeType.value = null;
    }

    isLoadingLyrics.value = true;
    try {
      const lyrics = isTauriRuntime()
        ? await resolveLyricsSource({
          ...(props.activeTrack ?? {}),
          rawLyrics: activeLyrics.value?.rawLyrics ?? rawLyrics ?? null,
          lyricsSourceUrl: activeLyrics.value?.lyricsUrl ?? null,
          lyricsFormat: activeLyrics.value?.format ?? null,
        })
        : parseRawLyrics(activeLyrics.value?.rawLyrics ?? rawLyrics ?? '');
      if (requestId !== lyricsLoadRequestId) return;
      loadedLyricLines.value = normalizeLyricLines(lyrics);

      if (!usableArtworkUrl && !lyricsCoverCache.has(nextCoverCacheKey) && !lyricsCoverCache.has(nextThumbCacheKey)) {
        const { key, cover } = await loadLyricsCoverThumbnail(path, artwork, coverVersion, identityKey);
        if (requestId !== lyricsLoadRequestId) return;
        if (cover) {
          retainLyricsCoverCache(key);
          releaseLyricsCoverCache(activeCoverCacheKey.value);
          activeCoverCacheKey.value = key;
          coverUrl.value = cover.url;
          coverData.value = cover.data;
          coverMimeType.value = cover.mimeType;
        }
      }

      if (!usableArtworkUrl) {
        const { key, cover } = await loadLyricsCover(path, artwork, coverVersion, identityKey);
        if (requestId !== lyricsLoadRequestId) return;
        if (key === activeCoverCacheKey.value && coverUrl.value) return;
        if (cover) {
          retainLyricsCoverCache(key);
          releaseLyricsCoverCache(activeCoverCacheKey.value);
          activeCoverCacheKey.value = key;
          coverUrl.value = cover.url;
          coverData.value = cover.data;
          coverMimeType.value = cover.mimeType;
        }
      }
    } finally {
      if (requestId !== lyricsLoadRequestId) return;
      isLoadingLyrics.value = false;
      await syncLyricsToCurrentTime();
    }
  },
  { immediate: true, flush: 'sync' },
);

watch(
  () => props.currentTime,
  (currentTime) => {
    smoothCurrentTime.value = currentTime;
    lastLyricFrameAt = performance.now();
  },
  { immediate: true },
);

watch(activeLyricIndex, async () => {
  if (activeLyricIndex.value < 0) return;
  if (isLoadingLyrics.value) return;
  if (isBrowsingLyrics.value) return;

  await scrollToActiveLyric();
});

async function syncLyricsToCurrentTime() {
  if (activeLyricIndex.value < 0) return;
  if (isBrowsingLyrics.value) return;

  await scrollToActiveLyric('auto');
}

async function scrollToActiveLyric(behavior: ScrollBehavior = 'smooth') {
  await nextTick();
  const panel = lyricsPanel.value;
  const currentLine = panel?.querySelector<HTMLElement>('.lyrics-panel .current');
  if (!panel || !currentLine) return;

  const nextTop = currentLine.offsetTop - panel.clientHeight / 2 + currentLine.clientHeight / 2;
  panel.scrollTo({ top: Math.max(0, nextTop), behavior });
  requestAnimationFrame(syncScrollThumb);
}

function beginLyricBrowse() {
  if (!loadedLyricLines.value.length) return;
  isBrowsingLyrics.value = true;
  if (browseRestoreTimer) {
    window.clearTimeout(browseRestoreTimer);
    browseRestoreTimer = 0;
  }
}

function scheduleRealtimeLyricsRestore() {
  beginLyricBrowse();
  browseRestoreTimer = window.setTimeout(() => {
    restoreRealtimeLyrics();
  }, 900);
}

function showLyricsScrollbarWhileScrolling() {
  if (!loadedLyricLines.value.length) return;
  showLyricsListScrolling();
}

function handleLyricsWheel() {
  showLyricsScrollbarWhileScrolling();
  scheduleRealtimeLyricsRestore();
}

function hideLyricsScrollbar() {
  hideLyricsListScrolling();
}

function restoreRealtimeLyrics() {
  if (browseRestoreTimer) {
    window.clearTimeout(browseRestoreTimer);
    browseRestoreTimer = 0;
  }

  if (!isBrowsingLyrics.value) return;
  isBrowsingLyrics.value = false;
  void scrollToActiveLyric();
}

function syncScrollThumb() {
  const panel = lyricsPanel.value;
  if (!panel) return;

  const maxScrollTop = panel.scrollHeight - panel.clientHeight;
  if (maxScrollTop <= 0) {
    scrollThumbTop.value = 0;
    return;
  }

  scrollThumbTop.value = (panel.scrollTop / maxScrollTop) * 154;
}

function seekToLyric(line: LyricLine) {
  if (line.time === null) return;
  emit('seek', Math.max(0, line.time - lyricTimeOffset.value));
}

function defaultLyricSearchQuery() {
  return [props.activeTrack?.title, props.activeTrack?.artist].filter(Boolean).join(' ').trim();
}

async function applyPluginLyrics(track: PluginSearchTrack) {
  const key = lyricTrackKey(track);
  resolvingLyricTrackKey.value = key;
  lyricSearchStatus.value = '';

  try {
    const source = await getPluginLyricsMetadata(track);
    const rawLyrics = source.rawLyrics?.trim();
    if (!rawLyrics) {
      lyricSearchStatus.value = '这个结果没有可用歌词';
      return;
    }

    const artwork = artworkDisplaySrc(track.artwork) || null;
    if (artwork) {
      releaseLyricsCoverCache(activeCoverCacheKey.value);
      activeCoverCacheKey.value = null;
      coverData.value = null;
      coverMimeType.value = null;
      coverUrl.value = artwork;
    }
    const lyrics = isTauriRuntime() ? await resolveRawLyrics(rawLyrics, source.format ?? source.defaultFormat ?? null) : parseRawLyrics(rawLyrics);
    loadedLyricLines.value = normalizeLyricLines(lyrics);
    emit(
      'lyricsFound',
      rawLyrics,
      artwork,
      track.providerName,
      source.lyricsUrl ?? `${track.providerName}@${track.providerId}`,
      source.formats ?? [],
      source.defaultFormat ?? null,
      source.format ?? source.defaultFormat ?? null,
      track.providerId,
      track.id,
      track.raw ?? track,
    );
    closeLyricSearchDialog();
    await scrollToActiveLyric();
  } catch (error) {
    lyricSearchStatus.value = getErrorMessage(error);
  } finally {
    if (resolvingLyricTrackKey.value === key) {
      resolvingLyricTrackKey.value = null;
    }
  }
}

function setLyricFontSize(size: number) {
  player.setLyricFontSize(Math.min(MAX_LYRIC_FONT_SIZE, Math.max(MIN_LYRIC_FONT_SIZE, size)));
  void scrollToActiveLyric();
}

function decreaseLyricFontSize() {
  setLyricFontSize(lyricFontSize.value - 1);
}

function increaseLyricFontSize() {
  setLyricFontSize(lyricFontSize.value + 1);
}

function openLyricSyncControls() {
  isLyricSyncOpen.value = true;
  closeFontMenu();
}

function shiftLyricTiming(deltaSeconds: number) {
  lyricTimeOffset.value = Math.round((lyricTimeOffset.value + deltaSeconds) * 10) / 10;
  void scrollToActiveLyric();
}

function openFontMenu(event: MouseEvent) {
  const menuWidth = 204;
  const menuHeight = 284;
  fontMenuLeft.value = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  fontMenuTop.value = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  isFontMenuOpen.value = true;
}

function closeFontMenu() {
  isFontMenuOpen.value = false;
}

function closeFontMenuOnOutsidePointer(event: PointerEvent) {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('.lyrics-font-menu')) return;
  closeFontMenu();
}

function clearAssociatedLyrics() {
  loadedLyricLines.value = [];
  releaseLyricsCoverCache(activeCoverCacheKey.value);
  activeCoverCacheKey.value = null;
  coverUrl.value = '';
  coverData.value = null;
  coverMimeType.value = null;
  emit('lyricsCleared');
  closeFontMenu();
}

async function updateFullscreenState() {
  if (!isTauriRuntime()) return;
  isFullscreen.value = await getCurrentWindow().isFullscreen();
}

async function toggleLyricsFullscreen() {
  if (!isTauriRuntime()) return;
  const appWindow = getCurrentWindow();
  const currentlyFullscreen = await appWindow.isFullscreen();

  if (currentlyFullscreen) {
    await appWindow.setFullscreen(false);
    isFullscreen.value = false;
    if (restoreMaximizedAfterFullscreen) {
      await appWindow.maximize();
      restoreMaximizedAfterFullscreen = false;
    }
    return;
  }

  restoreMaximizedAfterFullscreen = await appWindow.isMaximized();
  if (restoreMaximizedAfterFullscreen) {
    await appWindow.unmaximize();
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  await appWindow.setFullscreen(true);
  isFullscreen.value = true;
}

async function closeLyricsView() {
  if (isTauriRuntime() && isFullscreen.value) {
    const appWindow = getCurrentWindow();
    await appWindow.setFullscreen(false);
    isFullscreen.value = false;
    if (restoreMaximizedAfterFullscreen) {
      await appWindow.maximize();
      restoreMaximizedAfterFullscreen = false;
    }
  }
  emit('close');
}

onMounted(() => {
  document.addEventListener('pointerdown', closeFontMenuOnOutsidePointer);
  lyricAnimationFrame = window.requestAnimationFrame(tickLyricAnimation);
  void updateFullscreenState();
  void syncLyricsToCurrentTime();
});

onBeforeUnmount(() => {
  if (browseRestoreTimer) {
    window.clearTimeout(browseRestoreTimer);
  }
  if (lyricAnimationFrame) {
    window.cancelAnimationFrame(lyricAnimationFrame);
    lyricAnimationFrame = 0;
  }
  document.removeEventListener('pointerdown', closeFontMenuOnOutsidePointer);
  clearLyricsCoverCache();
  activeCoverCacheKey.value = null;
  if (isTauriRuntime() && isFullscreen.value) {
    void getCurrentWindow().setFullscreen(false).then(() => {
      if (restoreMaximizedAfterFullscreen) {
        return getCurrentWindow().maximize();
      }
      return undefined;
    });
  }
});

function handleCoverError() {
  if (coverUrl.value && !isTemporaryObjectUrl(coverUrl.value)) {
    failedArtworkUrls.add(coverUrl.value);
  }
  const key = activeCoverCacheKey.value;
  deleteLyricsCoverCache(key);
  activeCoverCacheKey.value = null;
  coverUrl.value = '';
  const track = props.activeTrack;
  if (!track?.path) return;
  void (async () => {
    const identityKey = activeTrackIdentityKey.value || track.path;
    const { key, cover } = await loadLyricsCoverThumbnail(
      track.path,
      activeArtwork.value,
      track.coverVersion,
      identityKey,
    );
    if (!cover || props.activeTrack?.path !== track.path) return;
    retainLyricsCoverCache(key);
    releaseLyricsCoverCache(activeCoverCacheKey.value);
    activeCoverCacheKey.value = key;
    coverUrl.value = cover.url;
    coverData.value = cover.data;
    coverMimeType.value = cover.mimeType;
  })();
}
</script>

<template>
  <section
    class="lyrics-view"
    :class="{ 'has-cover-background': backgroundCoverUrl }"
    :style="lyricsViewStyle"
    @contextmenu.prevent="openFontMenu"
  >
    <button class="lyrics-close icon-button" type="button" :aria-label="t(player.settings.locale, 'close')" @click="closeLyricsView">
      <ChevronDown :size="22" />
    </button>
    <button
      class="lyrics-fullscreen icon-button"
      type="button"
      :aria-label="isFullscreen ? '退出全屏' : '全屏显示'"
      :title="isFullscreen ? '退出全屏' : '全屏显示'"
      @click.stop="toggleLyricsFullscreen"
    >
      <Minimize2 v-if="isFullscreen" :size="16" />
      <Maximize2 v-else :size="16" />
    </button>

    <header class="lyrics-heading">
      <h1>{{ activeTrack?.title || t(player.settings.locale, 'unknownTrack') }}</h1>
      <p>
        {{ activeTrack?.artist || t(player.settings.locale, 'unknownArtist') }}
        <span>-</span>
        {{ activeTrack?.album || t(player.settings.locale, 'localMusic') }}
      </p>
    </header>

    <div class="lyrics-stage">
      <div class="lyrics-cover album-cover" :class="{ 'has-cover-image': displayCoverUrl }">
        <img v-if="displayCoverUrl" :src="displayCoverUrl" alt="" @error="handleCoverError" />
        <template v-else>
          <DefaultCover class="lyrics-cover-placeholder-icon" :size="88" :stroke-width="2.1" />
        </template>
      </div>

      <div class="lyrics-panel-wrap" :class="{ 'is-scrolling': isLyricsListScrolling }">
        <div
          ref="lyricsPanel"
          class="lyrics-panel"
          :class="{ 'is-empty': !loadedLyricLines.length }"
          :aria-label="t(player.settings.locale, 'lyrics')"
          @pointerdown="beginLyricBrowse"
          @pointerup="restoreRealtimeLyrics"
          @pointercancel="restoreRealtimeLyrics"
          @mouseleave="restoreRealtimeLyrics(); hideLyricsScrollbar()"
          @scroll="syncScrollThumb"
          @wheel.passive="handleLyricsWheel"
        >
          <small v-if="isLyricsPending" class="lyrics-hint">{{ t(player.settings.locale, 'lyricsLoading') }}</small>
          <EmptyState v-else-if="!loadedLyricLines.length" class-name="lyrics-empty" :message="emptyLyricsMessage">
            <template #action>
              <button class="lyrics-search-link" type="button" @click.stop="openLyricSearchDialog">搜索歌词</button>
            </template>
          </EmptyState>
          <p
            v-for="(line, index) in loadedLyricLines"
            :key="`${line.time ?? 'plain'}-${line.text}-${index}`"
            :class="{
              current: index === activeLyricIndex,
              previous: index === activeLyricIndex - 1,
              'previous-far': index === activeLyricIndex - 2,
              next: index === activeLyricIndex + 1,
              'next-far': index === activeLyricIndex + 2,
              'next-farther': index === activeLyricIndex + 3,
              'can-seek': line.time !== null,
            }"
            :role="line.time !== null ? 'button' : undefined"
            :tabindex="line.time !== null ? 0 : undefined"
            @click="seekToLyric(line)"
            @keydown.enter="seekToLyric(line)"
            @keydown.space.prevent="seekToLyric(line)"
          >
            <template v-if="line.words?.length">
              <span
                v-for="(word, wordIndex) in line.words"
                :key="`${word.time}-${word.text}-${wordIndex}`"
                class="lyric-word"
                :style="{ '--lyric-word-progress': lyricWordProgress(line, index, wordIndex) }"
              >
                {{ word.text }}
              </span>
            </template>
            <template v-else>{{ line.text }}</template>
          </p>
        </div>
        <span v-if="loadedLyricLines.length" class="lyrics-scrollbar" aria-hidden="true">
          <i :style="{ transform: `translateY(${scrollThumbTop}px)` }"></i>
        </span>
        <div v-if="isLyricSyncOpen" class="lyrics-sync-controls" @pointerdown.stop>
          <button type="button" title="歌词快0.5秒" aria-label="歌词快0.5秒" @click="shiftLyricTiming(0.5)">
            <span>+</span>
            <strong>0.5</strong>
          </button>
          <button type="button" title="歌词慢0.5秒" aria-label="歌词慢0.5秒" @click="shiftLyricTiming(-0.5)">
            <span>-</span>
            <strong>0.5</strong>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isFontMenuOpen"
      class="lyrics-font-menu"
      :style="{ left: `${fontMenuLeft}px`, top: `${fontMenuTop}px` }"
      role="menu"
      aria-label="歌词操作"
      @contextmenu.prevent
      @pointerdown.stop
    >
      <span class="lyrics-font-menu-title">设置字号</span>
      <div class="lyrics-font-menu-row">
        <button type="button" aria-label="减小字号" @click="decreaseLyricFontSize">
          A<small>-</small>
        </button>
        <strong>{{ lyricFontSize }}</strong>
        <button type="button" aria-label="增大字号" @click="increaseLyricFontSize">
          A<small>+</small>
        </button>
      </div>
      <span class="lyrics-menu-separator" aria-hidden="true"></span>
      <button class="lyrics-menu-item" type="button" disabled>歌曲操作</button>
      <button class="lyrics-menu-item" type="button" :disabled="!hasDownloadableCover()" @click="downloadCover">下载封面</button>
      <button
        v-for="format in downloadableLyricFormats"
        :key="format"
        class="lyrics-menu-item"
        type="button"
        @click="downloadLyrics(format)"
      >
        下载歌词 (.{{ format }})
      </button>
      <span class="lyrics-menu-separator" aria-hidden="true"></span>
      <span v-if="activeLyrics?.rawLyrics && activeTrack" class="lyrics-menu-linked" :title="`已关联歌词：${linkedLyricsLabel(activeTrack)}`">
        已关联歌词：{{ linkedLyricsLabel(activeTrack) }}
      </span>
      <button class="lyrics-menu-item" type="button" @click="openLyricSearchDialog">搜索歌词</button>
      <button class="lyrics-menu-item" type="button" @click="openLyricSyncControls">同步歌词</button>
      <button v-if="hasAssociatedLyrics" class="lyrics-menu-item" type="button" @click="clearAssociatedLyrics">取消关联歌词</button>
    </div>

    <Teleport to="body">
      <BaseDialog
        v-if="isSearchDialogOpen"
        label="搜索歌词"
        close-label="关闭"
        close-on-overlay
        grid-template-rows="auto auto minmax(0, 1fr)"
        max-height="min(520px, calc(100vh - 80px))"
        overflow="hidden"
        panel-class="lyrics-search-dialog"
        width="min(560px, calc(100vw - 32px))"
        :z-index="240"
        @close="closeLyricSearchDialog"
      >
        <template #header>
          <SearchInput
            v-model="lyricSearchQuery"
            root-class="lyrics-search-field"
            placeholder="搜索歌词"
            @submit="searchPluginLyrics"
          />
        </template>

        <SegmentTabs
          v-if="lyricSearchProviders.length > 0"
          label="歌词来源"
          :items="lyricProviderTabItems"
          :model-value="lyricSearchProviderId"
          root-class="lyrics-provider-tabs"
          @select="selectLyricSearchProvider"
        />

        <div class="lyrics-search-results" @scroll="handleLyricSearchResultsScroll">
          <p v-if="isSearchingPluginLyrics" class="lyrics-search-state">正在搜索歌词...</p>
          <template v-else>
            <button
              v-for="track in lyricSearchResults"
              :key="lyricTrackKey(track)"
              class="lyrics-search-row"
              type="button"
              :disabled="resolvingLyricTrackKey === lyricTrackKey(track)"
              @click="applyPluginLyrics(track)"
            >
              <span class="lyrics-search-cover">
                <img v-if="track.artwork" :src="artworkDisplaySrc(track.artwork)" alt="" />
                <Music v-else :size="20" :stroke-width="2.4" />
              </span>
              <span class="lyrics-search-meta">
                <strong>{{ track.title }}</strong>
                <small>{{ track.artist || '未知歌手' }} · {{ track.providerName }}</small>
              </span>
              <small v-if="resolvingLyricTrackKey === lyricTrackKey(track)" class="lyrics-search-resolving">读取中</small>
            </button>
            <p v-if="isLoadingMorePluginLyrics" class="lyrics-search-state">正在加载更多...</p>
          </template>
          <p v-if="!isSearchingPluginLyrics && lyricSearchStatus" class="lyrics-search-state">{{ lyricSearchStatus }}</p>
        </div>
      </BaseDialog>
    </Teleport>
  </section>
</template>

<style scoped>
.lyrics-view {
  position: relative;
  grid-row: 1;
  min-height: 0;
  overflow: hidden;
  padding: 24px clamp(28px, 5vw, 72px) 16px;
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

.lyrics-close {
  position: absolute;
  top: 22px;
  left: 22px;
  z-index: 2;
}

.lyrics-fullscreen {
  position: absolute;
  top: 70px;
  right: 32px;
  z-index: 2;
  width: 36px;
  height: 36px;
  color: var(--smw-text-secondary);
}

.lyrics-fullscreen:hover {
  color: var(--smw-text-primary);
}

.lyrics-heading {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 16px;
  text-align: center;
}

.lyrics-heading h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 620;
  line-height: 1.1;
}

.lyrics-heading p {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
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

.lyrics-cover {
  position: relative;
  width: min(360px, 30vw);
  max-width: 360px;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.16);
}

.lyrics-cover::before {
  display: none;
}

.lyrics-cover.has-cover-image::before {
  display: none;
}

.lyrics-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lyrics-cover-placeholder-icon {
  opacity: 0.92;
}

.lyrics-panel-wrap {
  position: relative;
  width: 100%;
}

.lyrics-panel {
  display: grid;
  gap: 20px;
  justify-items: center;
  height: clamp(420px, 72vh, 760px);
  overflow-y: auto;
  padding: calc(clamp(420px, 72vh, 760px) * 0.32) 34px calc(clamp(420px, 72vh, 760px) * 0.42) 0;
  color: var(--smw-text-secondary);
  scroll-behavior: smooth;
  text-align: center;
  scrollbar-width: none;
}

.lyrics-panel::-webkit-scrollbar {
  display: none;
}

.lyrics-panel.is-empty {
  align-content: center;
  padding: 0 34px 0 0;
}

.lyrics-hint {
  color: var(--smw-text-muted);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
}

.lyrics-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
}

.lyrics-search-link {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
}

.lyrics-search-link {
  padding: 0;
  border: 0;
  color: var(--smw-accent-blue, #2f7df6);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.lyrics-search-link:hover,
.lyrics-search-link:focus-visible {
  text-decoration: underline;
  outline: none;
}

.lyrics-panel p {
  margin: 0;
  font-size: var(--lyrics-font-size, 22px);
  line-height: 1.25;
  opacity: 0.22;
  transform: scale(0.9);
  transition:
    opacity 240ms ease,
    color 240ms ease,
    font-size 240ms ease,
    transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.lyrics-panel p.can-seek {
  cursor: pointer;
}

.lyrics-panel p.can-seek:hover,
.lyrics-panel p.can-seek:focus-visible {
  color: var(--smw-lyrics-current);
  outline: none;
}

.lyrics-panel .current {
  color: var(--smw-lyrics-current);
  font-size: calc(var(--lyrics-font-size, 22px) + 10px);
  font-weight: 680;
  opacity: 1;
  transform: scale(1);
  text-shadow: 0 8px 24px color-mix(in srgb, var(--smw-lyrics-current) 18%, transparent);
}

.lyrics-panel .current .lyric-word {
  display: inline-block;
  color: transparent;
  background:
    linear-gradient(
      90deg,
      var(--smw-lyrics-current) 0 var(--lyric-word-progress, 0%),
      var(--smw-text-secondary) var(--lyric-word-progress, 0%) 100%
    );
  background-clip: text;
  -webkit-background-clip: text;
}

.lyrics-panel .current .lyric-word {
  text-shadow: 0 8px 24px color-mix(in srgb, var(--smw-lyrics-current) 22%, transparent);
}

.lyrics-panel .previous {
  opacity: 0.68;
  transform: scale(0.92);
}

.lyrics-panel .previous-far {
  opacity: 0.48;
  transform: scale(0.9);
}

.lyrics-panel .next {
  opacity: 0.58;
  transform: scale(0.96);
}

.lyrics-panel .next-far {
  opacity: 0.44;
  transform: scale(0.94);
}

.lyrics-panel .next-farther {
  opacity: 0.32;
  transform: scale(0.92);
}

.lyrics-scrollbar {
  position: absolute;
  top: 50%;
  right: 0;
  width: 4px;
  height: 220px;
  border-radius: 999px;
  background: var(--smw-border);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 160ms ease;
}

.lyrics-panel-wrap:hover.is-scrolling .lyrics-scrollbar {
  opacity: 1;
}

.lyrics-scrollbar i {
  display: block;
  width: 4px;
  height: 66px;
  border-radius: inherit;
  background: var(--smw-text-secondary);
  transition: transform 180ms ease;
}

.lyrics-sync-controls {
  position: absolute;
  top: 50%;
  right: 18px;
  z-index: 2;
  display: grid;
  gap: 16px;
  transform: translateY(-50%);
}

.lyrics-sync-controls button {
  display: grid;
  grid-template-rows: 16px 14px;
  width: 38px;
  height: 38px;
  place-items: center;
  padding: 0;
  border: 1.5px solid color-mix(in srgb, var(--smw-lyrics-current) 78%, var(--smw-text-primary));
  border-radius: 6px;
  color: var(--smw-lyrics-current);
  background: color-mix(in srgb, var(--smw-bg-workspace) 82%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  line-height: 1;
  backdrop-filter: blur(10px);
}

.lyrics-sync-controls button:hover,
.lyrics-sync-controls button:focus-visible {
  background: color-mix(in srgb, var(--smw-bg-hover) 88%, transparent);
  transform: translateY(-1px);
}

.lyrics-sync-controls button span {
  align-self: end;
  font-size: 15px;
  font-weight: 700;
}

.lyrics-sync-controls button strong {
  align-self: start;
  font-size: 11px;
  font-weight: 560;
}

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

.lyrics-search-results {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 12px 12px;
}

.lyrics-search-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.lyrics-search-row:hover,
.lyrics-search-row:focus-visible {
  background: var(--smw-bg-hover);
  outline: none;
}

.lyrics-search-row:disabled {
  cursor: wait;
  opacity: 0.72;
}

.lyrics-search-cover {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  overflow: hidden;
  border-radius: 7px;
  color: color-mix(in srgb, var(--smw-text-secondary, #8b95a3) 72%, #b7bdc7);
  background: color-mix(in srgb, var(--smw-bg-selected, #edf1f6) 72%, #ffffff);
}

.lyrics-search-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lyrics-search-meta {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.lyrics-search-meta strong,
.lyrics-search-meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-search-meta strong {
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 520;
}

.lyrics-search-meta small,
.lyrics-search-resolving,
.lyrics-search-state {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.lyrics-search-state {
  margin: 18px 8px;
  text-align: center;
}
</style>
