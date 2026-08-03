import { watch } from 'vue';
import { isTauriRuntime } from '../services/music';
import { clearSystemMedia, updateSystemMedia } from '../services/systemMedia';
import type { Track } from '../types/music';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseSystemMediaSyncOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  playbackTime: ReadonlyRefValue<number>;
  isAudioPlaying: ReadonlyRefValue<boolean>;
}

export function useSystemMediaSync({
  activeTrack,
  playbackTime,
  isAudioPlaying,
}: UseSystemMediaSyncOptions) {
  let lastSystemMediaSyncKey = '';
  let lastSystemMediaSyncAt = 0;

  async function syncSystemMediaState() {
    if (!isTauriRuntime()) return;

    const track = activeTrack.value;
    if (!track) {
      await clearSystemMedia().catch(() => {});
      return;
    }

    const roundedPosition = Math.max(0, Math.round(playbackTime.value * 10) / 10);
    const syncKey = [
      track.id,
      track.title,
      track.artist ?? '',
      track.album ?? '',
      track.artwork ?? '',
      track.duration ?? '',
      isAudioPlaying.value ? 'playing' : 'paused',
      Math.floor(roundedPosition),
    ].join('|');

    const now = Date.now();
    if (syncKey === lastSystemMediaSyncKey && now - lastSystemMediaSyncAt < 1000) return;
    lastSystemMediaSyncKey = syncKey;
    lastSystemMediaSyncAt = now;

    await updateSystemMedia({
      title: track.title || 'Mono Player',
      artist: track.artist,
      album: track.album,
      artwork: normalizeSystemMediaArtwork(track.artwork),
      trackPath: track.path,
      duration: track.duration,
      position: roundedPosition,
      isPlaying: isAudioPlaying.value,
    }).catch(() => {});
  }

  watch(
    () => [
      activeTrack.value,
      playbackTime.value,
      isAudioPlaying.value,
    ] as const,
    () => {
      void syncSystemMediaState();
    },
    { immediate: true },
  );
}

function normalizeSystemMediaArtwork(artwork: string | null | undefined) {
  if (!artwork || artwork.startsWith('blob:')) return null;
  return artwork;
}
