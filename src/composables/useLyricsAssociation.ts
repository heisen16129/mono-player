import type { ComputedRef, Ref } from 'vue';
import { getPluginLyricsMetadata } from '../services/pluginSearch';
import type { Track, TrackLyrics } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { artworkDisplaySrc } from '../utils/artwork';
import { getErrorMessage } from '../utils/error';

export function useLyricsAssociation(options: {
  activeTrack: ComputedRef<Track | null>;
  clearCoverState: () => void;
  closeFontMenu: () => void;
  closeLyricSearchDialog: () => void;
  lyricSearchStatus: Ref<string>;
  lyricTrackKey: (track: PluginSearchTrack) => string;
  onLyricsCleared: () => void;
  onLyricsFound: (
    lyrics: TrackLyrics,
    artwork?: string | null,
    sourceName?: string | null,
    providerId?: string | null,
    trackId?: string | null,
    trackRaw?: unknown,
  ) => void;
  resolvingLyricTrackKey: Ref<string | null>;
  setArtworkCover: (artwork: string) => void;
}) {
  function defaultLyricSearchQuery() {
    return [options.activeTrack.value?.title, options.activeTrack.value?.artist].filter(Boolean).join(' ').trim();
  }

  async function applyPluginLyrics(track: PluginSearchTrack) {
    const key = options.lyricTrackKey(track);
    options.resolvingLyricTrackKey.value = key;
    options.lyricSearchStatus.value = '';

    try {
      const source = await getPluginLyricsMetadata(track);
      const variant = source.lyrics.find((item) => item.format === source.defaultFormat) ?? source.lyrics[0] ?? null;
      if (!variant?.content.trim()) {
        options.lyricSearchStatus.value = '这个结果没有可用歌词';
        return;
      }

      const artwork = artworkDisplaySrc(track.artwork) || null;
      if (artwork) {
        options.setArtworkCover(artwork);
      }
      options.onLyricsFound(
        source,
        artwork,
        track.providerName,
        track.providerId,
        track.id,
        track.raw ?? track,
      );
      options.closeLyricSearchDialog();
    } catch (error) {
      options.lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      if (options.resolvingLyricTrackKey.value === key) {
        options.resolvingLyricTrackKey.value = null;
      }
    }
  }

  function clearAssociatedLyrics() {
    options.clearCoverState();
    options.onLyricsCleared();
    options.closeFontMenu();
  }

  return {
    applyPluginLyrics,
    clearAssociatedLyrics,
    defaultLyricSearchQuery,
  };
}
