import type { Ref } from 'vue';
import { resolveLocale } from '../i18n';
import type { RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption, PluginSearchTrack } from '../types/plugin';
import { createOnlineQueueTrack } from '../utils/onlineTrack';
import { normalizeOnlineErrorMessage } from '../utils/playback';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseOnlinePlaybackControllerOptions {
  player: ReturnType<typeof usePlayerStore>;
  playbackTime: Ref<number>;
  isAudioPlaying: Ref<boolean>;
  rustPlaybackQueue: Ref<Track[]>;
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  onlineActivePluginTrack: ReadonlyRefValue<PluginSearchTrack | null>;
  onlinePlaybackSource: Ref<string>;
  onlineResolvingTrackKey: Ref<string | null>;
  onlinePlaybackQuality: Ref<PluginPlaybackQuality>;
  onlinePlaybackQualityOptions: ReadonlyRefValue<PluginPlaybackQualityOption[]>;
  buildOnlinePlaybackQueue: (sourceTrack: PluginSearchTrack, playbackTrack: Track, queueTracks?: Track[]) => Track[];
  changeRustQueueTrackQuality: (
    quality: PluginPlaybackQuality,
    startPosition: number,
    providerId?: string | null,
    sourceId?: string | null,
    track?: Track | null,
  ) => Promise<RustQueueSnapshot>;
  clearOnlineSearchError: () => void;
  clearPreparingPlaybackState: () => void;
  findNextOnlineSearchTrack: (track: PluginSearchTrack) => PluginSearchTrack | null;
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  setOnlineSearchError: (message: string) => void;
  showToast: (message: string) => void;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
  stopRustPlayback: (fade?: boolean) => Promise<void>;
  withDownloadedPlaybackSource: (track: Track) => Track;
}

export function useOnlinePlaybackController({
  player,
  playbackTime,
  isAudioPlaying,
  rustPlaybackQueue,
  onlineActiveTrack,
  onlineActivePluginTrack,
  onlinePlaybackSource,
  onlineResolvingTrackKey,
  onlinePlaybackQuality,
  onlinePlaybackQualityOptions,
  buildOnlinePlaybackQueue,
  changeRustQueueTrackQuality,
  clearOnlineSearchError,
  clearPreparingPlaybackState,
  findNextOnlineSearchTrack,
  getOnlineTrackKey,
  handleRustQueueSnapshot,
  setOnlineSearchError,
  showToast,
  startRustPlaybackQueue,
  stopRustPlayback,
  withDownloadedPlaybackSource,
}: UseOnlinePlaybackControllerOptions) {
  async function playOnlineTrack(track: PluginSearchTrack, startTime = 0, queueTracks?: Track[]) {
    const playbackTrack = withDownloadedPlaybackSource(createOnlineQueueTrack(track));
    const trackKey = getOnlineTrackKey(track);

    playbackTime.value = startTime;
    clearOnlineSearchError();
    onlineResolvingTrackKey.value = trackKey;
    rustPlaybackQueue.value = buildOnlinePlaybackQueue(track, playbackTrack, queueTracks);

    try {
      player.error = null;
      await startRustPlaybackQueue(rustPlaybackQueue.value, playbackTrack, startTime);
    } catch (error) {
      const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Could not get playback URL.' : '无法获取播放地址', player.settings.locale);
      setOnlineSearchError(message);
      await handleOnlinePlaybackFailure(track, message);
    } finally {
      if (onlineResolvingTrackKey.value === trackKey) {
        onlineResolvingTrackKey.value = null;
      }
    }
  }

  async function handleOnlinePlaybackFailure(track: PluginSearchTrack, message: string) {
    clearPreparingPlaybackState();
    onlinePlaybackSource.value = '';
    await stopRustPlayback(false);
    isAudioPlaying.value = false;

    if (player.settings.onlinePlaybackFailureAction !== 'next') {
      showToast(message);
      return;
    }

    const nextTrack = findNextOnlineSearchTrack(track);
    if (!nextTrack) {
      showToast(`${message}，没有下一首可播放`);
      return;
    }

    showToast(`${message}，正在播放下一首`);
    await playOnlineTrack(nextTrack);
  }

  async function changeOnlinePlaybackQuality(quality: PluginPlaybackQuality) {
    const qualityOption = onlinePlaybackQualityOptions.value.find((option) => option.id === quality);
    if (qualityOption && !qualityOption.available) {
      console.warn('[plugin-playback] change online quality skipped', {
        requestedQuality: quality,
        reason: qualityOption.reason ?? 'quality unavailable',
      });
      return;
    }
    const previousQuality = onlinePlaybackQuality.value;
    onlinePlaybackQuality.value = quality;

    if (!onlineActivePluginTrack.value || !onlineActiveTrack.value) {
      console.warn('[plugin-playback] change online quality skipped', {
        requestedQuality: quality,
        reason: 'missing active online track',
      });
      return;
    }

    const track = onlineActivePluginTrack.value;
    try {
      handleRustQueueSnapshot(await changeRustQueueTrackQuality(
        quality,
        playbackTime.value,
        track.providerId,
        track.id,
        onlineActiveTrack.value,
      ));
    } catch (error) {
      console.warn('[plugin-playback] change online quality failed', {
        providerId: track.providerId,
        providerName: track.providerName,
        trackId: track.id,
        title: track.title,
        previousQuality,
        requestedQuality: quality,
        error,
      });
      const message = normalizeOnlineErrorMessage(error, resolveLocale(player.settings.locale) === 'en-US' ? 'Failed to switch quality.' : '切换音质失败', player.settings.locale);
      setOnlineSearchError(message);
      await handleOnlinePlaybackFailure(track, message);
    }
  }

  return {
    changeOnlinePlaybackQuality,
    handleOnlinePlaybackFailure,
    playOnlineTrack,
  };
}
