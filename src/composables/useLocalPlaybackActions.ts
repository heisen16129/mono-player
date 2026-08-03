import { resolveLocale } from '../i18n';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLocalPlaybackActionsOptions {
  player: ReturnType<typeof usePlayerStore>;
  rustPlaybackQueue: ReadonlyRefValue<Track[]>;
  visibleTracks: ReadonlyRefValue<Track[]>;
  startRustPlaybackQueue: (tracks: Track[], requestedTrack: Track | null, startPosition?: number) => Promise<boolean>;
}

export function useLocalPlaybackActions({
  player,
  rustPlaybackQueue,
  visibleTracks,
  startRustPlaybackQueue,
}: UseLocalPlaybackActionsOptions) {
  async function playTrack(track: Track) {
    if (!track.path) {
      player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'This song has no local file path. Scan a music folder first.' : '这首歌没有本地文件路径，请先扫描音乐文件夹后再播放。';
      return;
    }

    player.error = null;
    await startRustPlaybackQueue(visibleTracks.value, track);
  }

  async function playFavoriteTracks() {
    const playableTracks = visibleTracks.value.filter((track) => track.path);
    if (playableTracks.length === 0) {
      player.error = resolveLocale(player.settings.locale) === 'en-US' ? 'There is no playable local music in the current list.' : '当前列表里没有可播放的本地音乐。';
      return;
    }

    player.error = null;
    await startRustPlaybackQueue(playableTracks, null);
  }

  async function playQueueTrack(track: Track) {
    player.error = null;
    await startRustPlaybackQueue(rustPlaybackQueue.value.length ? rustPlaybackQueue.value : [track], track);
  }

  return {
    playFavoriteTracks,
    playQueueTrack,
    playTrack,
  };
}
