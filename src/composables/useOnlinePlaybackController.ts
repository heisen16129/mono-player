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
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  handlePlaybackFailure: (message: string) => Promise<void> | void;
  setOnlineSearchError: (message: string) => void;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useOnlinePlaybackController({
  player,
  playbackTime,
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
  getOnlineTrackKey,
  handleRustQueueSnapshot,
  handlePlaybackFailure,
  setOnlineSearchError,
  startRustPlaybackQueue,
}: UseOnlinePlaybackControllerOptions) {
  async function playOnlineTrack(track: PluginSearchTrack, startTime = 0, queueTracks?: Track[]) {
    const playbackTrack = createOnlineQueueTrack(track);
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
      onlinePlaybackSource.value = '';
      await handlePlaybackFailure(message);
    } finally {
      if (onlineResolvingTrackKey.value === trackKey) {
        onlineResolvingTrackKey.value = null;
      }
    }
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
      onlinePlaybackSource.value = '';
      await handlePlaybackFailure(message);
    }
  }

  return {
    changeOnlinePlaybackQuality,
    playOnlineTrack,
  };
}
