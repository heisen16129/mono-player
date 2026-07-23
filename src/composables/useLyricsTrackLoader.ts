import { watch, type ComputedRef, type Ref } from 'vue';
import { isTauriRuntime, resolveLyricsSource } from '../services/music';
import type { LyricLine, Track, TrackLyrics } from '../types/music';
import { parseRawLyrics } from '../utils/lyrics';

interface LyricsCoverValue {
  data: number[] | null;
  mimeType: string | null;
  url: string;
}

export function normalizeLyricLines(lines: LyricLine[]) {
  return lines.filter((line) => {
    const text = line.text.trim();
    return text && text !== '...' && text !== '…';
  });
}

export function useLyricsTrackLoader(options: {
  activeArtwork: ComputedRef<string | null | undefined>;
  activeLyrics: ComputedRef<TrackLyrics | null | undefined>;
  activeTrack: ComputedRef<Track | null>;
  activeTrackIdentityKey: ComputedRef<string>;
  applyCover: (key: string, cover: LyricsCoverValue) => void;
  clearCoverState: () => void;
  hasLyricsCoverCache: (key: string) => boolean;
  isActiveCoverDisplayed: (key: string) => boolean;
  isLoadingLyrics: Ref<boolean>;
  isLyricSyncOpen: Ref<boolean>;
  lyricFormat: ComputedRef<string | null>;
  lines: Ref<LyricLine[]>;
  loadLyricsCover: (path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource?: string) => Promise<{ key: string; cover: LyricsCoverValue | null }>;
  loadLyricsCoverThumbnail: (path: string, artwork: string | null | undefined, coverVersion: number | undefined, cacheSource?: string) => Promise<{ key: string; cover: LyricsCoverValue | null }>;
  lyricTimeOffset: Ref<number>;
  prepareTrackCover: (identityKey: string, artwork: string | null | undefined, coverVersion: number | undefined) => {
    nextCoverCacheKey: string;
    nextThumbCacheKey: string;
    usableArtworkUrl: string | null;
  };
  syncLyricsToCurrentTime: () => Promise<void>;
}) {
  let lyricsLoadRequestId = 0;

  watch(
    () => [
      options.activeTrackIdentityKey.value,
      options.activeTrack.value?.path,
      options.activeTrack.value?.title,
      options.activeTrack.value?.artist,
      options.activeArtwork.value,
      options.activeLyrics.value?.lyrics,
      options.lyricFormat.value,
      options.activeTrack.value?.coverVersion,
    ] as const,
    async ([identityKey, path, _title, _artist, artwork, _lyrics, lyricFormat, coverVersion]) => {
      const requestId = ++lyricsLoadRequestId;
      options.lyricTimeOffset.value = 0;
      options.isLyricSyncOpen.value = false;
      if (!identityKey || !path) {
        options.lines.value = [];
        options.clearCoverState();
        return;
      }

      const { nextCoverCacheKey, nextThumbCacheKey, usableArtworkUrl } = options.prepareTrackCover(identityKey, artwork, coverVersion);

      options.isLoadingLyrics.value = true;
      try {
        const variant = options.activeLyrics.value?.lyrics.find((item) => item.format === lyricFormat)
          ?? options.activeLyrics.value?.lyrics[0]
          ?? null;
        const lyrics = isTauriRuntime()
          ? await resolveLyricsSource({
            content: variant?.content ?? null,
            format: variant?.format ?? null,
          })
          : parseRawLyrics(variant?.content ?? '');
        if (requestId !== lyricsLoadRequestId) return;
        options.lines.value = normalizeLyricLines(lyrics);
        await options.syncLyricsToCurrentTime();

        if (!usableArtworkUrl && !options.hasLyricsCoverCache(nextCoverCacheKey) && !options.hasLyricsCoverCache(nextThumbCacheKey)) {
          const { key, cover } = await options.loadLyricsCoverThumbnail(path, artwork, coverVersion, identityKey);
          if (requestId !== lyricsLoadRequestId) return;
          if (cover) {
            options.applyCover(key, cover);
          }
        }

        if (!usableArtworkUrl) {
          const { key, cover } = await options.loadLyricsCover(path, artwork, coverVersion, identityKey);
          if (requestId !== lyricsLoadRequestId) return;
          if (options.isActiveCoverDisplayed(key)) return;
          if (cover) {
            options.applyCover(key, cover);
          }
        }
      } finally {
        if (requestId !== lyricsLoadRequestId) return;
        options.isLoadingLyrics.value = false;
        await options.syncLyricsToCurrentTime();
      }
    },
    { immediate: true, flush: 'sync' },
  );
}
