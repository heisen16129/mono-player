import type { ComputedRef, Ref } from 'vue';
import { isTauriRuntime, resolveLyricsSource } from '../services/music';
import { getPluginLyricsMetadata } from '../services/pluginSearch';
import type { LyricLine, Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { artworkDisplaySrc } from '../utils/artwork';
import { getErrorMessage } from '../utils/error';
import { parseRawLyrics } from '../utils/lyrics';
import { normalizeLyricLines } from './useLyricsTrackLoader';

export function useLyricsAssociation(options: {
  activeTrack: ComputedRef<Track | null>;
  clearCoverState: () => void;
  closeFontMenu: () => void;
  closeLyricSearchDialog: () => void;
  lines: Ref<LyricLine[]>;
  lyricSearchStatus: Ref<string>;
  lyricTrackKey: (track: PluginSearchTrack) => string;
  onLyricsCleared: () => void;
  onLyricsFound: (
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
  ) => void;
  resolvingLyricTrackKey: Ref<string | null>;
  scrollToActiveLyric: () => Promise<void>;
  setArtworkCover: (artwork: string) => void;
}) {
  function defaultLyricSearchQuery() {
    return [options.activeTrack.value?.title, options.activeTrack.value?.artist].filter(Boolean).join(' ').trim();
  }

  async function resolveRawLyrics(rawLyrics: string, format?: string | null) {
    return resolveLyricsSource({
      rawLyrics,
      lyricsFormat: format ?? null,
    });
  }

  async function applyPluginLyrics(track: PluginSearchTrack) {
    const key = options.lyricTrackKey(track);
    options.resolvingLyricTrackKey.value = key;
    options.lyricSearchStatus.value = '';

    try {
      const source = await getPluginLyricsMetadata(track);
      const rawLyrics = source.rawLyrics?.trim();
      if (!rawLyrics) {
        options.lyricSearchStatus.value = '这个结果没有可用歌词';
        return;
      }

      const artwork = artworkDisplaySrc(track.artwork) || null;
      if (artwork) {
        options.setArtworkCover(artwork);
      }
      const lyrics = isTauriRuntime() ? await resolveRawLyrics(rawLyrics, source.format ?? source.defaultFormat ?? null) : parseRawLyrics(rawLyrics);
      options.lines.value = normalizeLyricLines(lyrics);
      options.onLyricsFound(
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
      options.closeLyricSearchDialog();
      await options.scrollToActiveLyric();
    } catch (error) {
      options.lyricSearchStatus.value = getErrorMessage(error);
    } finally {
      if (options.resolvingLyricTrackKey.value === key) {
        options.resolvingLyricTrackKey.value = null;
      }
    }
  }

  function clearAssociatedLyrics() {
    options.lines.value = [];
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
