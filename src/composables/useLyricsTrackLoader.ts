import { watch, type ComputedRef, type Ref } from 'vue';
import { isTauriRuntime, resolveLyricsSource } from '../services/music';
import type { LyricLine, Track, TrackLyrics } from '../types/music';
import { parseRawLyrics } from '../utils/lyrics';

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
  clearCoverState: () => void;
  isLoadingLyrics: Ref<boolean>;
  isLyricSyncOpen: Ref<boolean>;
  lyricFormat: ComputedRef<string | null>;
  lines: Ref<LyricLine[]>;
  lyricTimeOffset: Ref<number>;
  prepareTrackCover: (artwork: string | null | undefined) => void;
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
    async ([identityKey, path, _title, _artist, artwork, _lyrics, lyricFormat, _coverVersion], previousValue) => {
      const requestId = ++lyricsLoadRequestId;
      const previousIdentityKey = previousValue?.[0] ?? null;
      if (identityKey !== previousIdentityKey) {
        options.lines.value = [];
      }
      options.lyricTimeOffset.value = 0;
      options.isLyricSyncOpen.value = false;
      if (!identityKey || !path) {
        options.clearCoverState();
        return;
      }

      options.prepareTrackCover(artwork);

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
      } finally {
        if (requestId !== lyricsLoadRequestId) return;
        options.isLoadingLyrics.value = false;
        await options.syncLyricsToCurrentTime();
      }
    },
    { immediate: true, flush: 'sync' },
  );
}
