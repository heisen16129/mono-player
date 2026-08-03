import type { Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track, TrackLyrics } from '../types/music';
import { normalizePath } from '../utils/path';
import type { OnlineToastVariant } from './useOnlineToast';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UsePlaybackLyricsActionsOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
  selectedTrack: Ref<Track | null>;
  isRemoteTrack: (track: Track) => boolean;
  showToast: (message: string, variant?: OnlineToastVariant) => void;
}

interface PlaybackLyricActionContext {
  playbackLyricFormat: ReadonlyRefValue<string | null>;
  playbackLyricMetadata: ReadonlyRefValue<TrackLyrics | null | undefined>;
  setSelectedLyricFormat: (track: Track | null, format: string | null) => void;
}

export function usePlaybackLyricsActions({
  activeTrack,
  onlineActiveTrack,
  player,
  selectedTrack,
  isRemoteTrack,
  showToast,
}: UsePlaybackLyricsActionsOptions) {
  let lyricActionContext: PlaybackLyricActionContext | null = null;

  function registerPlaybackLyricActionContext(context: PlaybackLyricActionContext) {
    lyricActionContext = context;
  }

  async function changeLyricFormat(format: string) {
    if (!lyricActionContext) return;
    const active = activeTrack.value;
    if (!active || format === lyricActionContext.playbackLyricFormat.value) return;
    const lyrics = lyricActionContext.playbackLyricMetadata.value;
    if (!lyrics?.lyrics.some((variant) => variant.format === format)) {
      showToast('这个歌词格式没有可用内容', 'error');
      return;
    }
    lyricActionContext.setSelectedLyricFormat(active, format);
  }

  function updateCurrentLocalTrackLyrics(track: Track, lyrics: TrackLyrics) {
    if (onlineActiveTrack.value && isRemoteTrack(onlineActiveTrack.value)) return;
    const current = player.currentTrack ?? selectedTrack.value;
    if (!current) return;
    const sameTrack = current.id === track.id || normalizePath(current.path) === normalizePath(track.path);
    if (!sameTrack) return;

    const nextTrack: Track = {
      ...current,
      lyrics,
      artwork: current.artwork ?? track.artwork ?? null,
    };
    player.setCurrentTrack(nextTrack);
    if (selectedTrack.value && (selectedTrack.value.id === track.id || normalizePath(selectedTrack.value.path) === normalizePath(track.path))) {
      selectedTrack.value = nextTrack;
    }
  }

  return {
    changeLyricFormat,
    registerPlaybackLyricActionContext,
    updateCurrentLocalTrackLyrics,
  };
}
