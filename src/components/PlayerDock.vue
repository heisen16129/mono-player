<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue';
import {
  Captions,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Download,
  Heart,
  Gauge,
  ListMusic,
  LocateFixed,
  Loader2,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Timer,
  Volume2,
  X,
} from '@lucide/vue';
import type { PlaybackMode, Track } from '../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../types/plugin';
import { getErrorMessage } from '../utils/error';
import { readCover, readCoverThumbnail } from '../services/music';
import {
  canUseRustAudioBackend,
  listenRustBackendAdvanced,
  listenRustBackendQueue,
  listenRustBackendOutputDeviceFallback,
  listenRustBackendState,
  listenRustBackendEnded,
  pauseRustBackend,
  playPathWithRustBackend,
  playUrlWithRustBackend,
  isRustPlayableUrl,
  seekRustBackend,
  setRustBackendSpeed,
  setRustBackendCacheDir,
  setRustBackendOutputDevice,
  pruneRustBackendCache,
  setRustBackendQueue,
  setRustBackendVolume,
  stopRustBackend,
  type RustQueueSnapshot,
  type RustPlayerState,
} from '../services/playerBackend';
import { formatDuration } from '../utils/format';
import { resolveLocale, songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import TrackCoverThumb from './TrackCoverThumb.vue';
import { clearPlayerOriginalCoverCache, playerCoverCacheKey, setPlayerArtworkCoverCache, setPlayerOriginalCoverCache } from '../services/playerCoverCache';

type SleepTimerAction = 'stop' | 'exit' | 'finishTrack';

const props = defineProps<{
  activeTrack: Track | null;
  canControlPlayback: boolean;
  lyricsOpen: boolean;
  isFavorite: boolean;
  onlineQuality: PluginPlaybackQuality;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  lyricFormat: string | null;
  lyricFormats: string[];
  playbackMode: PlaybackMode;
  playbackModeLabel: string;
  playRequestId: number;
  queue: Track[];
  restoreRequestId: number;
  restoreTime: number;
  seekRequestId: number;
  seekTime: number;
  isPreparingActiveTrack: boolean;
  showActiveTrackDownload: boolean;
  isActiveTrackDownloaded: boolean;
  isActiveTrackDownloading: boolean;
  showOnlineQuality: boolean;
  showLyricFormat: boolean;
  sleepTimerRequest: { minutes: number; action: SleepTimerAction | null } | null;
  sleepTimerRequestId: number;
  togglePlaybackRequestId: number;
}>();

const emit = defineEmits<{
  mouseenter: [];
  mouseleave: [];
  openDesktopLyrics: [];
  openLyrics: [];
  onlineQualityChange: [quality: PluginPlaybackQuality];
  lyricFormatChange: [format: string];
  downloadActiveTrack: [];
  playNext: [];
  playPrevious: [];
  timeChange: [value: number];
  toggleFavorite: [];
  togglePlaybackMode: [];
  playQueueTrack: [track: Track];
  seamlessAdvance: [track: Track];
  requestInitialPlayback: [];
  sleepTimerExit: [];
  trackPlayed: [];
  playbackStateChange: [isPlaying: boolean];
  playbackError: [message: string];
  spectrumChange: [levels: number[]];
}>();

const player = usePlayerStore();
const CROSSFADE_DURATION_MS = 3000;
const FADE_STATE_HOLD_MS = 900;
const PLAYBACK_ERROR_TIMEOUT_MS = 5200;
const isPlaying = ref(false);
const rustBackendActive = ref(false);
const currentTime = ref(0);
const playbackErrorMessage = ref('');
const rustQueueSnapshot = ref<RustQueueSnapshot | null>(null);
const volume = ref(72);
const previousVolume = ref(72);
const isMuted = ref(false);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const playbackRate = ref<(typeof playbackRates)[number]>(1);
const isScrubbingProgress = ref(false);
const sleepTimerMinutes = ref(player.settings.sleepTimerMinutes);
const sleepTimerHours = ref(0);
const sleepTimerEndsAt = ref<number | null>(null);
const sleepTimerRemainingSeconds = ref(0);
const sleepTimerPausedRemainingSeconds = ref<number | null>(null);
const isSleepTimerDialogOpen = ref(false);
const isSleepTimerStatusOpen = ref(false);
const sleepTimerTotalSeconds = ref(Math.max(60, player.settings.sleepTimerMinutes * 60));
const volumeControl = ref<HTMLElement | null>(null);
const speedControl = ref<HTMLElement | null>(null);
const qualityControl = ref<HTMLElement | null>(null);
const lyricFormatControl = ref<HTMLElement | null>(null);
const isQueueOpen = ref(false);
const queueControl = ref<HTMLElement | null>(null);
const queueTrackRefs = ref(new Map<number, HTMLElement>());
const spectrumLevels = ref<number[]>([]);
const runtimeDuration = ref(0);
const coverUrl = ref('');
const hasThemeBackground = computed(() => {
  return player.customThemes.some((theme) => theme.id === player.settings.theme && Boolean(theme.background));
});
const dockStyle = computed(() => ({
  '--dock-cover-bg': coverUrl.value ? `url("${coverUrl.value}")` : undefined,
}));
let sleepTimerTimeout = 0;
let sleepTimerTick = 0;
let playbackErrorTimeout = 0;
let sleepTimerStopAfterTrackPending = false;
let smoothProgressFrame = 0;
let smoothProgressBaseTime = 0;
let smoothProgressBasePosition = 0;
let lastSmoothTimeEmit = 0;
let lastPreviousTap = 0;
let unlistenRustPlaybackEnded: (() => void) | null = null;
let unlistenRustPlaybackState: (() => void) | null = null;
let unlistenRustPlaybackAdvanced: (() => void) | null = null;
let unlistenRustQueue: (() => void) | null = null;
let unlistenRustOutputDeviceFallback: (() => void) | null = null;
let seamlessQueuedSource = '';
let rustPlaybackStateHoldUntil = 0;
let coverLoadId = 0;

function revokeTemporaryCoverUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

async function cachePlayerOriginalCover(path: string, cacheKey: string, loadId: number) {
  try {
    const cover = await readCover(path);
    if (loadId !== coverLoadId) return;

    clearPlayerOriginalCoverCache();
    if (!cover?.data.length) return;
    setPlayerOriginalCoverCache(cacheKey, cover);
  } catch {
    if (loadId === coverLoadId) {
      clearPlayerOriginalCoverCache();
    }
  }
}

const totalDuration = computed(() => {
  return props.activeTrack?.duration || runtimeDuration.value || 0;
});
const hasTotalDuration = computed(() => totalDuration.value > 0);
const totalDurationLabel = computed(() => (hasTotalDuration.value ? formatDuration(totalDuration.value) : '--:--'));

const progress = computed(() => {
  if (!hasTotalDuration.value) return 0;
  return Math.min(100, (currentTime.value / totalDuration.value) * 100);
});

function canUseRustQueueSource(path: string | null | undefined) {
  if (!path) return false;
  if (path.startsWith('plugin://')) return true;
  return canUseRustAudioBackend(path);
}

const canPlayActiveTrackWithRust = computed(() => canUseRustQueueSource(props.activeTrack?.path));
const canAdvancePlaybackTime = computed(() => !props.isPreparingActiveTrack);
const rustQueueTracks = computed(() => {
  return rustQueueSnapshot.value?.tracks ?? [];
});
const queueTracks = computed(() => {
  return props.queue.length > 0 ? props.queue : rustQueueTracks.value;
});

const playbackRateLabel = computed(() => `${playbackRate.value}x`);
const onlineQualityLabel = computed(() => {
  return props.onlineQualityOptions.find((option) => option.id === props.onlineQuality)?.name ?? props.onlineQuality;
});
const lyricFormatLabel = computed(() => props.lyricFormat?.trim().toLowerCase() || props.lyricFormats[0] || '');
const isSleepTimerActive = computed(() => sleepTimerEndsAt.value !== null);
const isSleepTimerPaused = computed(() => sleepTimerPausedRemainingSeconds.value !== null);
const sleepTimerRemainingLabel = computed(() => {
  const minutes = Math.floor(sleepTimerRemainingSeconds.value / 60);
  const seconds = sleepTimerRemainingSeconds.value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});
const sleepTimerExecuteAtLabel = computed(() => {
  if (sleepTimerEndsAt.value === null) return '';
  return new Intl.DateTimeFormat(resolveLocale(player.settings.locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(sleepTimerEndsAt.value));
});
const sleepTimerProgressPercent = computed(() => {
  if (sleepTimerTotalSeconds.value <= 0) return 0;
  return Math.max(0, Math.min(100, (sleepTimerRemainingSeconds.value / sleepTimerTotalSeconds.value) * 100));
});
const sleepTimerPresetMinutes = [10, 20, 30, 45, 60];

function normalizedBackendPath(path: string | null | undefined) {
  return (path ?? '').replace(/\\/g, '/').toLocaleLowerCase();
}

function isActiveRustPath(path: string | null | undefined) {
  const normalizedPath = normalizedBackendPath(path);
  return normalizedPath === normalizedBackendPath(props.activeTrack?.path)
    || normalizedPath === normalizedBackendPath(seamlessQueuedSource);
}

function rustPlayableQueueTracks() {
  return props.queue
    .filter((track) => canUseRustQueueSource(track.path));
}

function findQueueTrackBySource(source: string) {
  const normalizedSource = normalizedBackendPath(source);
  return props.queue.find((track) => normalizedBackendPath(track.path) === normalizedSource) ?? null;
}

function syncRustQueue() {
  void setRustBackendQueue(
    rustPlayableQueueTracks(),
    canUseRustQueueSource(props.activeTrack?.path) ? props.activeTrack?.path ?? null : null,
    props.playbackMode,
    player.settings.seamlessPlayback,
    player.settings.crossfadePlayback,
    CROSSFADE_DURATION_MS,
  ).then((snapshot) => {
    rustQueueSnapshot.value = snapshot;
  }).catch(showPlaybackError);
}

function holdRustPlaybackStoppedState() {
  rustPlaybackStateHoldUntil = player.settings.fadePlayback ? Date.now() + FADE_STATE_HOLD_MS : 0;
}

function setPlaybackTime(value: number, syncExternal = true) {
  currentTime.value = Math.max(0, value);
  smoothProgressBasePosition = currentTime.value;
  smoothProgressBaseTime = window.performance.now();
  lastSmoothTimeEmit = smoothProgressBaseTime;
  if (syncExternal) {
    emit('timeChange', currentTime.value);
  }
}

function stopSmoothProgress() {
  if (!smoothProgressFrame) return;
  window.cancelAnimationFrame(smoothProgressFrame);
  smoothProgressFrame = 0;
}

function startSmoothProgress() {
  if (!canAdvancePlaybackTime.value) return;
  if (smoothProgressFrame) return;

  const tick = () => {
    if (!isPlaying.value || !rustBackendActive.value || !canAdvancePlaybackTime.value) {
      smoothProgressFrame = 0;
      return;
    }

    const now = window.performance.now();
    const elapsedSeconds = (now - smoothProgressBaseTime) / 1000;
    const nextTime = smoothProgressBasePosition + elapsedSeconds * playbackRate.value;
    currentTime.value = totalDuration.value ? Math.min(nextTime, totalDuration.value) : nextTime;
    if (now - lastSmoothTimeEmit > 200) {
      lastSmoothTimeEmit = now;
      emit('timeChange', currentTime.value);
    }
    smoothProgressFrame = window.requestAnimationFrame(tick);
  };

  smoothProgressFrame = window.requestAnimationFrame(tick);
}

function syncPlaybackTimeFromRust(position: number, playing: boolean) {
  if (isScrubbingProgress.value) return;
  if (!canAdvancePlaybackTime.value) {
    setPlaybackTime(0);
    stopSmoothProgress();
    return;
  }

  const nextPosition = Math.max(0, position);
  const now = window.performance.now();
  const estimatedPosition = smoothProgressBasePosition + ((now - smoothProgressBaseTime) / 1000) * playbackRate.value;

  if (!playing || Math.abs(nextPosition - estimatedPosition) > 0.75) {
    currentTime.value = nextPosition;
    emit('timeChange', currentTime.value);
  }

  smoothProgressBasePosition = nextPosition;
  smoothProgressBaseTime = now;
  if (playing) {
    startSmoothProgress();
  } else {
    stopSmoothProgress();
  }
}

function playbackErrorText(error: unknown) {
  return getErrorMessage(error, '未知错误');
}

function clearPlaybackError() {
  if (playbackErrorTimeout) {
    window.clearTimeout(playbackErrorTimeout);
    playbackErrorTimeout = 0;
  }
  playbackErrorMessage.value = '';
}

function showPlaybackError(error: unknown) {
  if (playbackErrorTimeout) {
    window.clearTimeout(playbackErrorTimeout);
    playbackErrorTimeout = 0;
  }
  const message = `播放失败：${playbackErrorText(error)}`;
  playbackErrorMessage.value = '';
  emit('playbackError', message);
}

function showPlaybackNotice(message: string) {
  if (playbackErrorTimeout) {
    window.clearTimeout(playbackErrorTimeout);
  }
  playbackErrorMessage.value = message;
  playbackErrorTimeout = window.setTimeout(clearPlaybackError, PLAYBACK_ERROR_TIMEOUT_MS);
}

function outputDeviceFallbackMessage(previousDeviceId: string) {
  if (resolveLocale(player.settings.locale) === 'en-US') {
    return `Output device disconnected. Switched back to system default: ${previousDeviceId}`;
  }

  return `输出设备已断开，已回退到系统默认设备：${previousDeviceId}`;
}

async function playAudio(restart = false, startTime = currentTime.value) {
  if (!props.activeTrack?.path) return;
  if (!canPlayActiveTrackWithRust.value) {
    showPlaybackError('当前音频源不是 Rust 后端可播放的本地文件、HTTP/HTTPS URL 或在线歌曲');
    return;
  }

  try {
    clearPlaybackError();
    rustPlaybackStateHoldUntil = 0;
    seamlessQueuedSource = '';
    if (restart) {
      await stopRustBackend(false);
      stopSmoothProgress();
      rustBackendActive.value = false;
      isPlaying.value = false;
    }
    if (isRustPlayableUrl(props.activeTrack.path)) {
      await playUrlWithRustBackend(props.activeTrack.path, restart, player.settings.fadePlayback);
    } else {
      await playPathWithRustBackend(props.activeTrack.path, restart, player.settings.fadePlayback);
    }
    if (startTime > 0) {
      await seekRustBackend(startTime);
      setPlaybackTime(startTime);
    }
    rustBackendActive.value = true;
    isPlaying.value = true;
    smoothProgressBasePosition = currentTime.value;
    smoothProgressBaseTime = window.performance.now();
    startSmoothProgress();
    void setRustBackendVolume(isMuted.value ? 0 : volume.value / 100);
    void setRustBackendSpeed(playbackRate.value);
    emit('playbackStateChange', true);
    emit('trackPlayed');
  } catch (error) {
    rustBackendActive.value = false;
    isPlaying.value = false;
    emit('playbackStateChange', false);
    showPlaybackError(error);
  }
}

async function loadAndPlaySource(startTime = 0) {
  await loadSource(startTime);
  await playAudio(true, startTime);
}

async function loadSource(startTime = 0) {
  if (!props.activeTrack?.path) return;

  void stopRustBackend(false);
  setPlaybackTime(0);
  isPlaying.value = false;
  rustBackendActive.value = false;
  if (startTime > 0) {
    setPlaybackTime(startTime);
  }
}

watch(
  () => props.restoreRequestId,
  async () => {
    if (!props.activeTrack?.path) return;
    await loadSource(props.restoreTime);
  },
  { flush: 'post' },
);

watch(
  () => props.activeTrack?.id,
  () => {
    runtimeDuration.value = 0;
    setPlaybackTime(0);
  },
);

watch(
  () => props.isPreparingActiveTrack,
  (preparing) => {
    if (!preparing) return;
    setPlaybackTime(0);
    stopSmoothProgress();
  },
);

watch(
  () => [props.activeTrack?.path, props.activeTrack?.artwork, props.activeTrack?.coverVersion] as const,
  async ([path, artwork]) => {
    const currentLoadId = ++coverLoadId;
    if (coverUrl.value) {
      revokeTemporaryCoverUrl(coverUrl.value);
    }
    coverUrl.value = '';

    if (artwork) {
      coverUrl.value = artwork;
      setPlayerArtworkCoverCache(playerCoverCacheKey(props.activeTrack), artwork);
      return;
    }

    if (!path) {
      clearPlayerOriginalCoverCache();
      return;
    }
    const cacheKey = playerCoverCacheKey(props.activeTrack);
    clearPlayerOriginalCoverCache();

    try {
      const cover = await readCoverThumbnail(path);
      if (currentLoadId !== coverLoadId) return;
      if (!cover?.data.length) return;

      const blob = new Blob([new Uint8Array(cover.data)], { type: cover.mime_type });
      coverUrl.value = URL.createObjectURL(blob);
    } catch {
      coverUrl.value = '';
    }

    if (currentLoadId === coverLoadId) {
      void cachePlayerOriginalCover(path, cacheKey, currentLoadId);
    }
  },
  { immediate: true },
);

watch(
  () => props.playRequestId,
  async () => {
    setPlaybackTime(0);
    await playAudio(true, 0);
  },
  { flush: 'post' },
);

watch(
  () => props.seekRequestId,
  async () => {
    if (!props.activeTrack?.path) return;
    if (!rustBackendActive.value) {
      await loadAndPlaySource(props.seekTime);
      return;
    }

    try {
      await seekRustBackend(props.seekTime);
      setPlaybackTime(props.seekTime);
    } catch (error) {
      showPlaybackError(error);
    }
  },
  { flush: 'post' },
);

watch(
  () => props.sleepTimerRequestId,
  () => {
    const request = props.sleepTimerRequest;
    if (!request) return;
    const minutes = Math.min(999, Math.max(1, Math.round(Number(request.minutes) || 0)));
    if (request.action) {
      player.setSleepTimerAction(request.action);
    }
    sleepTimerHours.value = Math.floor(minutes / 60);
    sleepTimerMinutes.value = minutes % 60;
    startSleepTimer();
  },
);

watch(
  () => props.togglePlaybackRequestId,
  async () => {
    await togglePlayback();
  },
  { flush: 'post' },
);

watch(
  () => props.activeTrack?.path,
  (path) => {
    if (seamlessQueuedSource && normalizedBackendPath(path) === normalizedBackendPath(seamlessQueuedSource)) {
      seamlessQueuedSource = '';
    }
  },
);

watch(
  () => [
    props.queue,
    props.activeTrack?.path,
    props.playbackMode,
    player.settings.seamlessPlayback,
    player.settings.crossfadePlayback,
  ] as const,
  syncRustQueue,
  { deep: true, immediate: true },
);

async function togglePlayback() {
  if (!props.canControlPlayback) {
    if (props.activeTrack?.path) {
      emit('requestInitialPlayback');
    }
    return;
  }

  if (rustBackendActive.value) {
    if (isPlaying.value) {
      holdRustPlaybackStoppedState();
      try {
        await pauseRustBackend(player.settings.fadePlayback);
      } catch (error) {
        showPlaybackError(error);
        return;
      }
      isPlaying.value = false;
      stopSmoothProgress();
      emit('playbackStateChange', false);
      return;
    }

    await playAudio();
    return;
  }

  await playAudio();
}

function previewSeekAudio(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!totalDuration.value) return;
  isScrubbingProgress.value = true;
  stopSmoothProgress();
  setPlaybackTime((Number(target.value) / 100) * totalDuration.value, false);
}

async function commitSeekAudio() {
  if (!totalDuration.value) return;
  isScrubbingProgress.value = false;
  emit('timeChange', currentTime.value);
  if (rustBackendActive.value) {
    try {
      await seekRustBackend(currentTime.value);
      smoothProgressBasePosition = currentTime.value;
      smoothProgressBaseTime = window.performance.now();
      if (isPlaying.value) {
        startSmoothProgress();
      }
    } catch (error) {
      showPlaybackError(error);
      return;
    }
  }
}

function applyVolume() {
  if (rustBackendActive.value) {
    void setRustBackendVolume(isMuted.value ? 0 : volume.value / 100);
  }
}

function changePlaybackRate(event: Event) {
  const target = event.target as HTMLInputElement;
  const nextRate = Number(target.value);
  playbackRate.value = Math.min(2, Math.max(0.5, nextRate)) as (typeof playbackRates)[number];
  smoothProgressBasePosition = currentTime.value;
  smoothProgressBaseTime = window.performance.now();
  if (rustBackendActive.value) {
    void setRustBackendSpeed(playbackRate.value);
  }
}

function changeVolume(event: Event) {
  const target = event.target as HTMLInputElement;
  volume.value = Number(target.value);
  if (volume.value > 0) {
    previousVolume.value = volume.value;
    isMuted.value = false;
  } else {
    isMuted.value = true;
  }
  applyVolume();
}

function toggleMute() {
  if (isMuted.value) {
    isMuted.value = false;
    volume.value = previousVolume.value || 72;
  } else {
    previousVolume.value = volume.value || previousVolume.value || 72;
    isMuted.value = true;
  }
  applyVolume();
}

function closeVolumePopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && volumeControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function closeSpeedPopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && speedControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function closeQualityPopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && qualityControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function closeLyricFormatPopover() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && lyricFormatControl.value?.contains(activeElement)) {
    activeElement.blur();
  }
}

function openSleepTimerDialog() {
  if (!isSleepTimerActive.value && !isSleepTimerPaused.value) {
    const totalMinutes = Math.max(1, Math.round(Number(sleepTimerMinutes.value) || player.settings.sleepTimerMinutes));
    sleepTimerHours.value = Math.floor(totalMinutes / 60);
    sleepTimerMinutes.value = totalMinutes % 60;
  }
  isSleepTimerDialogOpen.value = true;
}

function closeSleepTimerDialog() {
  isSleepTimerDialogOpen.value = false;
}

function closeSleepTimerStatus() {
  isSleepTimerStatusOpen.value = false;
}

function handleSleepTimerButtonClick() {
  if (isSleepTimerActive.value || isSleepTimerPaused.value) {
    isSleepTimerStatusOpen.value = !isSleepTimerStatusOpen.value;
    return;
  }

  openSleepTimerDialog();
}

function setSleepTimerPreset(minutes: number) {
  sleepTimerHours.value = Math.floor(minutes / 60);
  sleepTimerMinutes.value = minutes % 60;
}

function stopPlayback() {
  if (rustBackendActive.value) {
    holdRustPlaybackStoppedState();
    void stopRustBackend(player.settings.fadePlayback);
  }
  isPlaying.value = false;
  stopSmoothProgress();
  emit('playbackStateChange', false);
}

function clearSleepTimer() {
  if (sleepTimerTimeout) {
    window.clearTimeout(sleepTimerTimeout);
    sleepTimerTimeout = 0;
  }

  if (sleepTimerTick) {
    window.clearInterval(sleepTimerTick);
    sleepTimerTick = 0;
  }

  sleepTimerEndsAt.value = null;
  sleepTimerRemainingSeconds.value = 0;
  sleepTimerPausedRemainingSeconds.value = null;
  isSleepTimerStatusOpen.value = false;
  sleepTimerStopAfterTrackPending = false;
}

function updateSleepTimerRemaining() {
  if (sleepTimerEndsAt.value === null) return;
  sleepTimerRemainingSeconds.value = Math.max(0, Math.ceil((sleepTimerEndsAt.value - Date.now()) / 1000));
}

function runSleepTimerAction() {
  const action = player.settings.sleepTimerAction;
  if (action === 'finishTrack') {
    if (sleepTimerTimeout) {
      window.clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = 0;
    }
    if (sleepTimerTick) {
      window.clearInterval(sleepTimerTick);
      sleepTimerTick = 0;
    }
    sleepTimerEndsAt.value = null;
    sleepTimerRemainingSeconds.value = 0;
    sleepTimerPausedRemainingSeconds.value = null;
    sleepTimerStopAfterTrackPending = true;
    return;
  }

  clearSleepTimer();
  stopPlayback();

  if (action === 'exit') {
    emit('sleepTimerExit');
  }
}

function startSleepTimer() {
  const hours = Math.min(99, Math.max(0, Math.round(Number(sleepTimerHours.value) || 0)));
  const minutePart = Math.min(59, Math.max(0, Math.round(Number(sleepTimerMinutes.value) || 0)));
  const minutes = Math.min(999, Math.max(1, hours * 60 + minutePart));
  sleepTimerHours.value = Math.floor(minutes / 60);
  sleepTimerMinutes.value = minutes % 60;
  player.setSleepTimerMinutes(minutes);
  clearSleepTimer();

  sleepTimerTotalSeconds.value = minutes * 60;
  sleepTimerEndsAt.value = Date.now() + minutes * 60_000;
  updateSleepTimerRemaining();
  sleepTimerTick = window.setInterval(updateSleepTimerRemaining, 1000);
  sleepTimerTimeout = window.setTimeout(runSleepTimerAction, minutes * 60_000);
  closeSleepTimerDialog();
  isSleepTimerStatusOpen.value = false;
}

function pauseSleepTimer() {
  if (sleepTimerEndsAt.value === null) return;
  sleepTimerPausedRemainingSeconds.value = sleepTimerRemainingSeconds.value;
  if (sleepTimerTimeout) {
    window.clearTimeout(sleepTimerTimeout);
    sleepTimerTimeout = 0;
  }
  if (sleepTimerTick) {
    window.clearInterval(sleepTimerTick);
    sleepTimerTick = 0;
  }
  sleepTimerEndsAt.value = null;
}

function resumeSleepTimer() {
  const remainingSeconds = sleepTimerPausedRemainingSeconds.value;
  if (!remainingSeconds) return;
  sleepTimerPausedRemainingSeconds.value = null;
  sleepTimerEndsAt.value = Date.now() + remainingSeconds * 1000;
  updateSleepTimerRemaining();
  sleepTimerTick = window.setInterval(updateSleepTimerRemaining, 1000);
  sleepTimerTimeout = window.setTimeout(runSleepTimerAction, remainingSeconds * 1000);
}

function requestPreviousTrack() {
  const now = window.performance.now();
  if (now - lastPreviousTap < 120) return;
  lastPreviousTap = now;
  emit('playPrevious');
}

function requestNextTrack() {
  emit('playNext');
}

function requestPlaybackModeToggle() {
  emit('togglePlaybackMode');
}

function requestFavoriteToggle() {
  emit('toggleFavorite');
}

function toggleQueuePanel() {
  isQueueOpen.value = !isQueueOpen.value;
}

function closeQueuePanelOnOutsidePointer(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (queueControl.value?.contains(target)) return;
  isQueueOpen.value = false;
}

function playQueueTrack(track: Track) {
  if (!track.path) return;
  emit('playQueueTrack', track);
}

function setQueueTrackRef(trackId: number, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    queueTrackRefs.value.set(trackId, element);
    return;
  }

  queueTrackRefs.value.delete(trackId);
}

async function locateQueueTrack() {
  if (!props.activeTrack) return;

  await nextTick();
  queueTrackRefs.value.get(props.activeTrack.id)?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

watch(isQueueOpen, async (open) => {
  if (open) {
    await nextTick();
    document.addEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
    return;
  }

  document.removeEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
});

watch(
  () => player.settings.sleepTimerMinutes,
  (minutes) => {
    if (!isSleepTimerActive.value) {
      sleepTimerMinutes.value = minutes;
    }
  },
);

watch(
  () => player.settings.audioCacheDir,
  (cacheDir) => {
    void setRustBackendCacheDir(cacheDir || null);
    void pruneRustBackendCache(player.settings.audioCacheMaxMb * 1024 * 1024);
  },
  { immediate: true },
);

watch(
  () => player.settings.audioCacheMaxMb,
  (sizeMb) => {
    void pruneRustBackendCache(sizeMb * 1024 * 1024);
  },
  { immediate: true },
);

watch(
  () => player.settings.audioOutputDeviceId,
  (deviceId) => {
    void setRustBackendOutputDevice(deviceId || null);
  },
  { immediate: true },
);

function handleRustPlaybackState(state: RustPlayerState) {
  if (!isActiveRustPath(state.currentPath)) {
    if (rustBackendActive.value) {
      rustBackendActive.value = false;
      isPlaying.value = false;
      stopSmoothProgress();
      emit('playbackStateChange', false);
    }
    spectrumLevels.value = [];
    runtimeDuration.value = 0;
    emit('spectrumChange', []);
    return;
  }

  rustBackendActive.value = true;
  spectrumLevels.value = state.isPlaying ? (state.spectrumLevels ?? []) : [];
  if (!props.activeTrack?.duration && state.duration && state.duration > 0) {
    runtimeDuration.value = state.duration;
  }
  emit('spectrumChange', spectrumLevels.value);
  syncPlaybackTimeFromRust(state.position, state.isPlaying);

  if (!state.isPlaying) {
    rustPlaybackStateHoldUntil = 0;
  }
  if (!isPlaying.value && state.isPlaying && Date.now() < rustPlaybackStateHoldUntil) {
    return;
  }

  if (isPlaying.value !== state.isPlaying) {
    isPlaying.value = state.isPlaying;
    emit('playbackStateChange', state.isPlaying);
  }
}

onMounted(async () => {
  unlistenRustPlaybackAdvanced = await listenRustBackendAdvanced((source) => {
    if (sleepTimerStopAfterTrackPending) {
      sleepTimerStopAfterTrackPending = false;
      void stopRustBackend(false);
      return;
    }
    const queuedTrack = findQueueTrackBySource(source);
    if (!queuedTrack) return;

    setPlaybackTime(0);
    emit('seamlessAdvance', queuedTrack);
    seamlessQueuedSource = source;
  });
  unlistenRustPlaybackState = await listenRustBackendState(handleRustPlaybackState);
  unlistenRustQueue = await listenRustBackendQueue((snapshot) => {
    rustQueueSnapshot.value = snapshot;
  });
  unlistenRustOutputDeviceFallback = await listenRustBackendOutputDeviceFallback((event) => {
    if (player.settings.audioOutputDeviceId) {
      player.setAudioOutputDeviceId('');
    }
    showPlaybackNotice(outputDeviceFallbackMessage(event.previousDeviceId));
  });
  unlistenRustPlaybackEnded = await listenRustBackendEnded(() => {
    if (!rustBackendActive.value) return;

    if (sleepTimerStopAfterTrackPending) {
      sleepTimerStopAfterTrackPending = false;
      isPlaying.value = false;
      rustBackendActive.value = false;
      stopSmoothProgress();
      emit('playbackStateChange', false);
      return;
    }
    isPlaying.value = false;
    rustBackendActive.value = false;
    stopSmoothProgress();
    emit('playbackStateChange', false);
  });
});

onBeforeUnmount(() => {
  void stopRustBackend(false);
  stopSmoothProgress();
  clearSleepTimer();
  clearPlaybackError();
  document.removeEventListener('pointerdown', closeQueuePanelOnOutsidePointer);
  unlistenRustPlaybackAdvanced?.();
  unlistenRustPlaybackState?.();
  unlistenRustQueue?.();
  unlistenRustOutputDeviceFallback?.();
  unlistenRustPlaybackEnded?.();
  if (coverUrl.value) {
    revokeTemporaryCoverUrl(coverUrl.value);
  }
  clearPlayerOriginalCoverCache();
});

function handleCoverError() {
  if (coverUrl.value) {
    revokeTemporaryCoverUrl(coverUrl.value);
  }
  coverUrl.value = '';
}
</script>

<template>
  <footer
    class="player-dock"
    :class="{ 'has-cover-background': coverUrl && !hasThemeBackground }"
    :style="dockStyle"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
  >
    <input
      class="dock-progress"
      type="range"
      min="0"
      max="100"
      step="0.01"
      :value="progress"
      :style="{ '--progress-percent': `${progress}%` }"
      :aria-label="t(player.settings.locale, 'playback')"
      @input="previewSeekAudio"
      @change="commitSeekAudio"
    />

    <Transition name="playback-error">
      <div v-if="playbackErrorMessage" class="playback-error" role="alert">
        <span>{{ playbackErrorMessage }}</span>
        <button type="button" aria-label="关闭播放错误提示" @click="clearPlaybackError">×</button>
      </div>
    </Transition>

    <div class="mini-now">
      <button class="cover-button" type="button" :aria-label="t(player.settings.locale, 'openLyrics')" @click="emit('openLyrics')">
        <Transition name="cover-roll" mode="out-in">
          <span v-if="lyricsOpen" key="collapse" class="cover-mini cover-collapse-icon">
            <ChevronsDown :size="24" />
          </span>
          <span v-else key="artwork" class="cover-mini cover-artwork-shell">
            <img v-if="coverUrl" class="cover-image" :src="coverUrl" alt="" @error="handleCoverError" />
            <span v-else class="cover-placeholder-fill night"></span>
          </span>
        </Transition>
        <span v-if="!lyricsOpen && coverUrl" class="cover-hover-cue" aria-hidden="true">
          <ChevronsUp :size="24" />
        </span>
      </button>
      <Transition name="info-roll" mode="out-in">
        <span v-if="!lyricsOpen" key="track" class="track-info">
          <strong>{{ activeTrack?.title || t(player.settings.locale, 'unknownTrack') }}</strong>
          <small>{{ activeTrack ? (activeTrack.artist || t(player.settings.locale, 'unknownArtist')) : t(player.settings.locale, 'readyToPlay') }}</small>
        </span>
        <span v-else key="blank" class="track-info track-info-lyrics-open">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </span>
      </Transition>
      <span class="time-pair">
        <span>{{ formatDuration(currentTime) }}</span>
        <span>/</span>
        <span>{{ totalDurationLabel }}</span>
      </span>
    </div>

    <div class="transport">
      <button
        class="icon-button favorite-button"
        :class="{ 'is-favorite': isFavorite }"
        type="button"
        :disabled="!activeTrack"
        :aria-label="t(player.settings.locale, 'favorite')"
        :title="t(player.settings.locale, 'favorite')"
        @click="requestFavoriteToggle"
      >
        <Heart :size="18" :fill="isFavorite ? 'currentColor' : 'none'" />
      </button>
      <button
        class="icon-button"
        type="button"
        :disabled="!activeTrack"
        aria-label="Previous"
        @click="requestPreviousTrack"
        @pointerup="requestPreviousTrack"
      >
        <SkipBack :size="18" fill="currentColor" />
      </button>
      <button class="play-button" type="button" :disabled="!activeTrack" @click="togglePlayback">
        <Pause v-if="isPlaying" :size="22" fill="currentColor" />
        <Play v-else :size="22" fill="currentColor" />
      </button>
      <button class="icon-button" type="button" :disabled="!activeTrack" aria-label="Next" @click="requestNextTrack">
        <SkipForward :size="18" fill="currentColor" />
      </button>
      <button
        class="icon-button"
        type="button"
        :aria-label="playbackModeLabel"
        :title="playbackModeLabel"
        @click="requestPlaybackModeToggle"
      >
        <Shuffle v-if="playbackMode === 'shuffle'" :size="18" />
        <Repeat2 v-else-if="playbackMode === 'repeat'" :size="18" />
        <Repeat1 v-else :size="18" />
      </button>
    </div>

    <div class="playback-meta">
      <button
        v-if="showActiveTrackDownload"
        class="icon-button dock-download-button"
        :class="{ 'is-downloaded': isActiveTrackDownloaded, 'is-downloading': isActiveTrackDownloading }"
        type="button"
        :disabled="isActiveTrackDownloaded || isActiveTrackDownloading"
        :aria-label="isActiveTrackDownloaded ? '已下载' : isActiveTrackDownloading ? '下载中' : '下载'"
        :title="isActiveTrackDownloaded ? '已下载' : isActiveTrackDownloading ? '下载中' : '下载'"
        @click="!isActiveTrackDownloading && emit('downloadActiveTrack')"
      >
        <CheckCircle2 v-if="isActiveTrackDownloaded" :size="18" />
        <Loader2 v-else-if="isActiveTrackDownloading" :size="18" />
        <Download v-else :size="18" />
      </button>
      <div v-if="showOnlineQuality && onlineQualityOptions.length > 0" ref="qualityControl" class="quality-control" @mouseleave="closeQualityPopover">
        <div class="quality-popover" role="menu" aria-label="插件音质">
          <button
            v-for="option in onlineQualityOptions"
            :key="option.id"
            type="button"
            role="menuitemradio"
            :class="{ 'is-active': onlineQuality === option.id }"
            :aria-checked="onlineQuality === option.id"
            :disabled="!option.available"
            :title="option.reason ?? option.name"
            @click="option.available && emit('onlineQualityChange', option.id as PluginPlaybackQuality)"
          >
            {{ option.name }}
          </button>
        </div>
        <button
          class="quality-button"
          type="button"
          :aria-label="`音质：${onlineQualityLabel}`"
          :title="`音质：${onlineQualityLabel}`"
        >
          <span>{{ onlineQualityLabel }}</span>
        </button>
      </div>
      <div v-if="showLyricFormat && lyricFormats.length > 1" ref="lyricFormatControl" class="quality-control" @mouseleave="closeLyricFormatPopover">
        <div class="quality-popover" role="menu" aria-label="歌词格式">
          <button
            v-for="format in lyricFormats"
            :key="format"
            type="button"
            role="menuitemradio"
            :class="{ 'is-active': lyricFormat === format }"
            :aria-checked="lyricFormat === format"
            @click="emit('lyricFormatChange', format)"
          >
            {{ format }}
          </button>
        </div>
        <button
          class="quality-button"
          type="button"
          :aria-label="`歌词格式：${lyricFormatLabel}`"
          :title="`歌词格式：${lyricFormatLabel}`"
        >
          <span>{{ lyricFormatLabel }}</span>
        </button>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="打开桌面歌词"
        title="打开桌面歌词"
        @click="emit('openDesktopLyrics')"
      >
        <Captions class="desktop-lyrics-entry-icon" :size="19" :stroke-width="2.25" />
      </button>
      <div class="sleep-timer-control">
        <div v-if="isSleepTimerStatusOpen" class="sleep-timer-status" role="dialog" aria-label="定时关闭状态">
          <header>
            <strong>定时关闭</strong>
            <button type="button" aria-label="关闭" @click="closeSleepTimerStatus">
              <X :size="15" />
            </button>
          </header>
          <div class="sleep-timer-status-progress" :style="{ '--timer-progress': `${sleepTimerProgressPercent}%` }" aria-hidden="true">
            <i></i>
          </div>
          <p>
            剩余 {{ sleepTimerRemainingLabel }}
            <span v-if="sleepTimerExecuteAtLabel">· 将于 {{ sleepTimerExecuteAtLabel }} 执行</span>
          </p>
          <div class="sleep-timer-status-actions">
            <button type="button" @click="isSleepTimerPaused ? resumeSleepTimer() : pauseSleepTimer()">
              {{ isSleepTimerPaused ? '继续计时' : '暂停计时' }}
            </button>
            <button type="button" @click="clearSleepTimer">取消定时</button>
          </div>
        </div>
        <button
          class="sleep-timer-button"
          :class="{ 'is-active': isSleepTimerActive || isSleepTimerPaused }"
          type="button"
          :aria-label="isSleepTimerActive ? `定时关闭剩余 ${sleepTimerRemainingLabel}` : '定时关闭'"
          :title="isSleepTimerActive ? `定时关闭剩余 ${sleepTimerRemainingLabel}` : '定时关闭'"
          @click="handleSleepTimerButtonClick"
        >
          <Timer :size="15" />
          <span v-if="isSleepTimerActive || isSleepTimerPaused">{{ sleepTimerRemainingLabel }}</span>
        </button>
      </div>
      <div ref="speedControl" class="speed-control" @mouseleave="closeSpeedPopover">
        <div class="speed-popover">
          <div class="speed-rail" :style="{ '--speed-percent': `${((playbackRate - 0.5) / 1.5) * 100}%` }">
            <i aria-hidden="true"></i>
            <input
              class="speed vertical"
              type="range"
              min="0.5"
              max="2"
              step="0.25"
              :value="playbackRate"
              :aria-label="`播放速度 ${playbackRateLabel}`"
              orient="vertical"
              @input="changePlaybackRate"
            />
          </div>
          <span>{{ playbackRateLabel }}</span>
        </div>
        <button
          class="icon-button speed-button"
          type="button"
          :aria-label="`播放速度 ${playbackRateLabel}`"
          :title="`播放速度 ${playbackRateLabel}`"
        >
          <Gauge :size="18" />
        </button>
      </div>
      <div ref="volumeControl" class="volume-control" @mouseleave="closeVolumePopover">
        <div class="volume-popover">
          <div class="volume-rail" :style="{ '--volume-percent': `${isMuted ? 0 : volume}%` }">
            <i aria-hidden="true"></i>
            <input
              class="volume vertical"
              type="range"
              min="0"
              max="100"
              step="1"
              :value="isMuted ? 0 : volume"
              :aria-label="t(player.settings.locale, 'volume')"
              orient="vertical"
              @input="changeVolume"
            />
          </div>
          <span>{{ isMuted ? 0 : volume }}%</span>
        </div>
        <button
          class="icon-button volume-button"
          type="button"
          :aria-label="isMuted ? t(player.settings.locale, 'restoreVolume') : t(player.settings.locale, 'mute')"
          :title="isMuted ? t(player.settings.locale, 'restoreVolume') : t(player.settings.locale, 'mute')"
          @click="toggleMute"
        >
          <Volume2 :size="19" />
        </button>
      </div>
      <div ref="queueControl" class="queue-control">
        <button
          class="icon-button queue-button"
          :class="{ 'is-active': isQueueOpen }"
          type="button"
          :aria-label="t(player.settings.locale, 'playbackQueue')"
          :title="t(player.settings.locale, 'playbackQueue')"
          @click="toggleQueuePanel"
        >
          <ListMusic :size="18" />
        </button>

        <div v-if="isQueueOpen" class="queue-popover" role="dialog" :aria-label="t(player.settings.locale, 'nowPlayingQueue')">
          <header class="queue-popover-head">
            <div class="queue-title-actions">
              <strong>{{ t(player.settings.locale, 'playbackQueue') }}</strong>
              <button
                class="queue-locate-button"
                type="button"
                :disabled="!activeTrack || !queueTracks.some((track) => track.id === activeTrack?.id)"
                :aria-label="t(player.settings.locale, 'locateCurrentTrack')"
                :title="t(player.settings.locale, 'locateCurrentTrack')"
                @click="locateQueueTrack"
              >
                <LocateFixed :size="15" />
              </button>
            </div>
            <span>{{ songCount(player.settings.locale, queueTracks.length) }}</span>
          </header>

          <div v-if="queueTracks.length > 0" class="queue-list">
            <button
              v-for="(track, index) in queueTracks"
              :key="`${track.id}-${index}`"
              :ref="(element) => setQueueTrackRef(track.id, element)"
              class="queue-track"
              :class="{
                'is-current': activeTrack?.id === track.id,
                'has-index': player.settings.showTrackNumbers,
                'has-cover': player.settings.showTrackCovers,
              }"
              type="button"
              @click="playQueueTrack(track)"
            >
              <span v-if="player.settings.showTrackNumbers" class="queue-index">
                {{ index + 1 }}
              </span>
              <TrackCoverThumb
                v-if="player.settings.showTrackCovers"
                class="queue-cover"
                :track="track"
                :active="activeTrack?.id === track.id"
                :playing="isPlaying"
                :loading="isPreparingActiveTrack && activeTrack?.id === track.id"
                :spectrum-levels="activeTrack?.id === track.id ? spectrumLevels : []"
              />
              <span class="queue-info">
                <strong>{{ track.title }}</strong>
                <small>{{ track.artist || t(player.settings.locale, 'unknownArtist') }}</small>
              </span>
              <time>{{ formatDuration(track.duration) }}</time>
            </button>
          </div>

          <p v-else class="queue-empty">{{ t(player.settings.locale, 'emptyQueue') }}</p>
        </div>
      </div>
    </div>

  </footer>

  <Teleport to="body">
    <div v-if="isSleepTimerDialogOpen" class="sleep-timer-dialog-backdrop" @click.self="closeSleepTimerDialog">
      <section class="sleep-timer-dialog" role="dialog" aria-modal="true" aria-label="定时关闭">
        <header>
          <h2>定时关闭</h2>
          <button type="button" aria-label="关闭" @click="closeSleepTimerDialog">
            <X :size="20" />
          </button>
        </header>

        <p class="sleep-timer-section-label">选择时长</p>
        <div class="sleep-timer-presets">
          <button
            v-for="minutes in sleepTimerPresetMinutes"
            :key="minutes"
            type="button"
            :class="{ 'is-active': sleepTimerHours * 60 + sleepTimerMinutes === minutes }"
            @click="setSleepTimerPreset(minutes)"
          >
            <strong>{{ minutes }}</strong>
            <span>分钟</span>
          </button>
        </div>

        <div class="sleep-timer-or">
          <span></span>
          <small>或</small>
          <span></span>
        </div>

        <div class="sleep-timer-custom-time">
          <label>
            <input v-model.number="sleepTimerHours" type="number" min="0" max="99" step="1" />
            <span>小时</span>
          </label>
          <label>
            <input v-model.number="sleepTimerMinutes" type="number" min="0" max="59" step="1" />
            <span>分钟</span>
          </label>
        </div>

        <p class="sleep-timer-section-label">结束时执行</p>
        <div class="sleep-timer-action-options">
          <label>
            <input
              type="radio"
              name="sleep-timer-action"
              value="exit"
              :checked="player.settings.sleepTimerAction === 'exit'"
              @change="player.setSleepTimerAction('exit')"
            />
            <span>停止播放并退出程序</span>
          </label>
          <label>
            <input
              type="radio"
              name="sleep-timer-action"
              value="stop"
              :checked="player.settings.sleepTimerAction === 'stop'"
              @change="player.setSleepTimerAction('stop')"
            />
            <span>仅停止播放（保持程序运行）</span>
          </label>
          <label>
            <input
              type="radio"
              name="sleep-timer-action"
              value="finishTrack"
              :checked="player.settings.sleepTimerAction === 'finishTrack'"
              @change="player.setSleepTimerAction('finishTrack')"
            />
            <span>播放完整首歌后停止</span>
          </label>
        </div>

        <footer>
          <button
            v-if="isSleepTimerActive || isSleepTimerPaused"
            type="button"
            @click="isSleepTimerPaused ? resumeSleepTimer() : pauseSleepTimer()"
          >
            {{ isSleepTimerPaused ? '继续计时' : '暂停计时' }}
          </button>
          <button v-else type="button" @click="closeSleepTimerDialog">取消</button>
          <button v-if="isSleepTimerActive || isSleepTimerPaused" type="button" @click="clearSleepTimer">取消定时</button>
          <button type="button" @click="startSleepTimer">确认开启</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.player-dock {
  position: relative;
  z-index: 30;
  grid-row: 2;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(240px, 390px) minmax(340px, 1.35fr);
  gap: 14px;
  align-items: center;
  min-height: var(--player-height);
  padding: 10px 20px;
  border-top: 1px solid var(--smw-window-border);
  background: var(--smw-player-bg);
  transition:
    transform 260ms cubic-bezier(0.22, 0.76, 0.22, 1),
    opacity 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
  will-change: transform, opacity;
}


.dock-progress {
  position: absolute;
  z-index: 36;
  top: -7px;
  left: 0;
  width: 100%;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.dock-progress::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--smw-progress-fill) 0 var(--progress-percent),
    var(--smw-progress-track) var(--progress-percent) 100%
  );
}

.dock-progress::-webkit-slider-thumb {
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
  box-shadow: 0 0 0 1px var(--smw-progress-thumb-ring);
  appearance: none;
}

.dock-progress::-moz-range-track {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-track);
}

.dock-progress::-moz-range-progress {
  height: 2px;
  border-radius: 999px;
  background: var(--smw-progress-fill);
}

.dock-progress::-moz-range-thumb {
  width: 8px;
  height: 8px;
  border: 2px solid var(--smw-progress-thumb-border);
  border-radius: 50%;
  background: var(--smw-progress-thumb);
}

.playback-error {
  position: absolute;
  z-index: 45;
  left: 50%;
  bottom: calc(100% + 10px);
  display: flex;
  max-width: min(520px, calc(100vw - 40px));
  align-items: center;
  gap: 12px;
  padding: 9px 10px 9px 12px;
  border: 1px solid rgba(220, 38, 38, 0.26);
  border-radius: 6px;
  color: #991b1b;
  background: rgba(254, 242, 242, 0.96);
  box-shadow: 0 12px 30px rgba(80, 20, 20, 0.16);
  transform: translateX(-50%);
}

.playback-error span {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playback-error button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.playback-error button:hover {
  background: rgba(185, 28, 28, 0.1);
}

.playback-error-enter-active,
.playback-error-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.playback-error-enter-from,
.playback-error-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

.mini-now {
  display: grid;
  grid-column: 1;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.cover-button {
  position: relative;
  display: block;
  width: 52px;
  height: 52px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  outline: none;
  background: transparent;
  cursor: pointer;
  perspective: 180px;
  transition: transform 160ms ease;
}

.cover-button:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 42%, transparent);
}

.cover-button:active {
  transform: translateY(-1px) scale(0.98);
}

.mini-now .cover-mini {
  display: block;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  background:
    radial-gradient(circle at 35% 35%, var(--smw-cover-dot) 0 1px, transparent 2px),
    radial-gradient(circle at 62% 58%, var(--smw-cover-dot-soft) 0 1px, transparent 2px),
    linear-gradient(135deg, var(--smw-cover-base-deep), var(--smw-cover-base));
}

.mini-now .cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-artwork-shell {
  overflow: hidden;
}

.cover-placeholder-fill {
  display: block;
  width: 100%;
  height: 100%;
}

.mini-now .cover-collapse-icon {
  display: grid;
  place-items: center;
  color: var(--smw-text-primary);
  background: transparent;
  opacity: 0;
  transform: translateY(-8px) rotateX(52deg);
  transform-origin: 50% 50%;
  transition:
    opacity 160ms ease,
    transform 240ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-style: preserve-3d;
}

.cover-button:hover .cover-collapse-icon,
.cover-button:focus-visible .cover-collapse-icon {
  opacity: 1;
  transform: translateY(0) rotateX(0deg);
}

.cover-roll-enter-active,
.cover-roll-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-style: preserve-3d;
}

.cover-roll-enter-from {
  opacity: 0;
  transform: translateY(14px) rotateX(-72deg);
}

.cover-roll-leave-to {
  opacity: 0;
  transform: translateY(-14px) rotateX(72deg);
}

.info-roll-enter-active,
.info-roll-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 0.76, 0.22, 1);
  transform-origin: 50% 50%;
  transform-style: preserve-3d;
}

.info-roll-enter-from {
  opacity: 0;
  transform: translateY(10px) rotateX(-54deg);
}

.info-roll-leave-to {
  opacity: 0;
  transform: translateY(-10px) rotateX(54deg);
}

.cover-hover-cue {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(31, 32, 40, 0.62);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 150ms ease, transform 150ms ease;
}

.cover-button:hover .cover-hover-cue,
.cover-button:focus-visible .cover-hover-cue {
  opacity: 1;
  transform: translateY(0);
}

.track-info {
  display: grid;
  height: 52px;
  align-content: space-between;
  box-sizing: border-box;
  gap: 0;
  min-width: 0;
  padding: 5px 0;
}

.mini-now strong {
  display: block;
  overflow: hidden;
  color: var(--smw-text-primary);
  font-size: 14px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-now small {
  display: block;
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transport {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  transform: translate(-50%, -50%);
}

.play-button {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
}

.playback-meta {
  display: flex;
  grid-column: 3;
  gap: 10px;
  align-items: center;
  justify-content: end;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.playback-meta .icon-button,
.playback-meta .sleep-timer-button,
.playback-meta .quality-button {
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
}

.playback-meta .icon-button {
  width: 28px;
}

.playback-meta svg {
  width: 18px;
  height: 18px;
}

.playback-meta .desktop-lyrics-entry-icon {
  width: 19px;
  height: 19px;
}

.dock-download-button.is-downloaded {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloaded:hover,
.dock-download-button.is-downloaded:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloading:hover,
.dock-download-button.is-downloading:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading svg {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.quality-control {
  position: relative;
  display: grid;
  place-items: center;
}

.quality-control:hover,
.quality-control:focus-within {
  z-index: 44;
}

.quality-control::before {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 92px;
  height: 26px;
  content: "";
  transform: translateX(-50%);
}

.quality-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-button-primary-text, #fff);
  background: var(--smw-button-primary);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--smw-button-primary) 22%, transparent);
  font: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.quality-button:hover,
.quality-button:focus-visible {
  outline: none;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--smw-button-primary) 28%, transparent);
}

.quality-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 12px);
  z-index: 20;
  display: grid;
  min-width: 86px;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 10px;
  color: var(--smw-text-body);
  background: var(--smw-player-bg);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.quality-control:hover .quality-popover,
.quality-control:focus-within .quality-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.quality-popover button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.quality-popover button:hover,
.quality-popover button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.quality-popover button.is-active {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
  font-weight: 700;
}

.sleep-timer-control {
  position: relative;
  display: grid;
  place-items: center;
}

.sleep-timer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 32px;
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sleep-timer-button:hover,
.sleep-timer-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.sleep-timer-button.is-active {
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 12%, transparent);
}

.sleep-timer-button.is-active span {
  font-weight: 650;
}

.sleep-timer-status {
  position: absolute;
  right: -12px;
  bottom: 36px;
  z-index: 44;
  display: grid;
  gap: 10px;
  width: 282px;
  padding: 14px 12px 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-workspace);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
}

.sleep-timer-status header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sleep-timer-status strong {
  color: var(--smw-text-primary);
  font-size: 14px;
}

.sleep-timer-status header button {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  cursor: pointer;
}

.sleep-timer-status-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, #1677ff 14%, transparent);
}

.sleep-timer-status-progress i {
  display: block;
  width: var(--timer-progress);
  height: 100%;
  border-radius: inherit;
  background: #1677ff;
}

.sleep-timer-status p {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-status-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sleep-timer-status-actions button {
  height: 36px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 6px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  cursor: pointer;
}

.sleep-timer-status-actions button:last-child {
  color: #ef4444;
  border-color: #ef4444;
  background: transparent;
}

.sleep-timer-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.34);
}

.sleep-timer-dialog {
  display: grid;
  width: min(478px, calc(100vw - 28px));
  gap: 18px;
  padding: 26px 22px 22px;
  border-radius: 12px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-workspace);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.sleep-timer-dialog header,
.sleep-timer-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sleep-timer-dialog h2 {
  margin: 0;
  font-size: 18px;
}

.sleep-timer-dialog header button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  cursor: pointer;
}

.sleep-timer-section-label {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-presets {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.sleep-timer-presets button {
  display: grid;
  min-height: 58px;
  place-items: center;
  padding: 8px 0;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  cursor: pointer;
}

.sleep-timer-presets button.is-active {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-presets span {
  color: currentColor;
  font-size: 12px;
  opacity: 0.76;
}

.sleep-timer-or {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.sleep-timer-or span {
  height: 1px;
  background: var(--smw-border-soft);
}

.sleep-timer-custom-time {
  display: flex;
  gap: 16px;
}

.sleep-timer-custom-time label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.sleep-timer-custom-time input {
  width: 60px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-weight: 700;
  text-align: center;
}

.sleep-timer-custom-time input:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}

.sleep-timer-action-options {
  display: grid;
  overflow: hidden;
  border-radius: 8px;
}

.sleep-timer-action-options label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--smw-bg-selected) 36%, transparent);
  cursor: pointer;
}

.sleep-timer-action-options input {
  width: 18px;
  height: 18px;
  accent-color: var(--smw-button-primary);
}

.sleep-timer-dialog footer {
  gap: 12px;
}

.sleep-timer-dialog footer button {
  flex: 1;
  height: 46px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.sleep-timer-dialog footer button:last-child {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-dialog footer button:last-child:hover {
  filter: brightness(0.96);
}

.speed-control {
  position: relative;
  display: grid;
  place-items: center;
}

.speed-control::before {
  position: absolute;
  left: 50%;
  bottom: 24px;
  width: 54px;
  height: 24px;
  content: "";
  transform: translateX(-50%);
}

.speed-button {
  color: var(--smw-text-body);
}

.speed-button:hover,
.speed-button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.speed-popover {
  position: absolute;
  left: 50%;
  bottom: 34px;
  z-index: 42;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 42px;
  height: 132px;
  padding: 12px 0 8px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 2px;
  color: var(--smw-volume-fill);
  background: var(--smw-player-bg);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.speed-control:hover .speed-popover,
.speed-control:focus-within .speed-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.speed-rail {
  position: relative;
  width: 18px;
  height: 76px;
}

.speed-rail::before,
.speed-rail::after {
  position: absolute;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
  transform: translateX(-50%);
}

.speed-rail::before {
  inset-block: 0;
  background: var(--smw-volume-track);
}

.speed-rail::after {
  bottom: 0;
  height: var(--speed-percent);
  background: var(--smw-volume-fill);
  transition: height 80ms linear;
}

.speed-rail i {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: var(--speed-percent);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--smw-volume-thumb);
  transform: translate(-50%, 50%);
  transition: bottom 80ms linear;
}

.speed-rail .speed.vertical {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 76px;
  height: 18px;
  margin: 29px 0 0 -29px;
  opacity: 0;
  cursor: pointer;
  transform: rotate(-90deg);
}

.speed-rail .speed.vertical::-webkit-slider-runnable-track,
.speed-rail .speed.vertical::-webkit-slider-thumb,
.speed-rail .speed.vertical::-moz-range-track,
.speed-rail .speed.vertical::-moz-range-progress,
.speed-rail .speed.vertical::-moz-range-thumb {
  opacity: 0;
}

.speed-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}

.time-pair {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--smw-text-muted);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.time-pair span:first-child {
  color: var(--smw-text-primary);
  font-weight: 500;
}

.time-pair span:nth-child(2) {
  color: var(--smw-text-muted);
}

.time-pair span:last-child {
  color: var(--smw-text-secondary);
}

input[type="range"] {
  accent-color: var(--smw-progress-fill);
}

.volume {
  accent-color: var(--smw-text-primary);
}

.volume-control {
  position: relative;
  display: grid;
  place-items: center;
}

.volume-control::before {
  position: absolute;
  left: 50%;
  bottom: 24px;
  width: 54px;
  height: 24px;
  content: "";
  transform: translateX(-50%);
}

.volume-button {
  color: var(--smw-text-body);
}

.volume-popover {
  position: absolute;
  left: 50%;
  bottom: 34px;
  z-index: 42;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 38px;
  height: 132px;
  padding: 12px 0 8px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 2px;
  color: var(--smw-volume-fill);
  background: var(--smw-player-bg);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 6px);
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.volume-control:hover .volume-popover,
.volume-control:focus-within .volume-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.volume-rail {
  position: relative;
  width: 18px;
  height: 76px;
}

.volume-rail::before,
.volume-rail::after {
  position: absolute;
  left: 50%;
  width: 4px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
  transform: translateX(-50%);
}

.volume-rail::before {
  inset-block: 0;
  background: var(--smw-volume-track);
}

.volume-rail::after {
  bottom: 0;
  height: var(--volume-percent);
  background: var(--smw-volume-fill);
  transition: height 80ms linear;
}

.volume-rail i {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: var(--volume-percent);
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--smw-volume-thumb);
  transform: translate(-50%, 50%);
  transition: bottom 80ms linear;
}

.volume-rail .volume.vertical {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 76px;
  height: 18px;
  margin: 29px 0 0 -29px;
  opacity: 0;
  cursor: pointer;
  transform: rotate(-90deg);
}

.volume-rail .volume.vertical::-webkit-slider-runnable-track,
.volume-rail .volume.vertical::-webkit-slider-thumb,
.volume-rail .volume.vertical::-moz-range-track,
.volume-rail .volume.vertical::-moz-range-progress,
.volume-rail .volume.vertical::-moz-range-thumb {
  opacity: 0;
}
.volume-popover span {
  color: var(--smw-volume-text);
  font-size: 11px;
  line-height: 1;
}

.queue-control {
  position: relative;
  display: grid;
  place-items: center;
}

.queue-button {
  color: var(--smw-text-body);
}

.queue-popover {
  position: absolute;
  right: 0;
  bottom: 44px;
  z-index: 42;
  display: grid;
  width: min(360px, calc(100vw - 28px));
  max-height: min(460px, calc(100vh - 148px));
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-player-bg);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
}

.queue-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.queue-popover-head strong {
  color: var(--smw-text-primary);
  font-size: 15px;
}

.queue-title-actions {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.queue-locate-button {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.queue-locate-button:hover {
  color: var(--smw-text-primary);
}

.queue-locate-button:disabled {
  cursor: default;
  color: var(--smw-icon-muted);
  opacity: 0.42;
}

.queue-popover-head span {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-list {
  display: grid;
  max-height: 390px;
  overflow: auto;
  padding: 6px;
}

.queue-track {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 48px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.queue-track.has-index {
  grid-template-columns: 28px minmax(0, 1fr) auto;
}

.queue-track.has-cover {
  grid-template-columns: 30px minmax(0, 1fr) auto;
}

.queue-track.has-index.has-cover {
  grid-template-columns: 28px 30px minmax(0, 1fr) auto;
}

.queue-track:hover {
  background: var(--smw-bg-hover);
}

.queue-track.is-current {
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
}

.queue-index {
  display: grid;
  place-items: center;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-cover {
  justify-self: center;
}

.queue-info {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.queue-info strong,
.queue-info small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-info strong {
  font-size: 13px;
  font-weight: 600;
}

.queue-info small,
.queue-track time {
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.queue-track time {
  padding-right: 4px;
  font-variant-numeric: tabular-nums;
}

.queue-empty {
  margin: 0;
  padding: 30px 16px;
  color: var(--smw-text-secondary);
  text-align: center;
}

</style>
