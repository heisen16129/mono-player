import { watch } from 'vue';
import { broadcastDesktopLyricsState, openDesktopLyricsWindow, toggleDesktopLyricsWindow } from '../services/desktopLyrics';
import type { Track, TrackLyricVariant } from '../types/music';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface DesktopLyricsSettings {
  useThemeLyricColor: boolean;
  lyricFontColor: string;
  theme: string;
}

interface UseDesktopLyricsSyncOptions {
  activeTrack: ReadonlyRefValue<Track | null>;
  playbackLyricVariant: ReadonlyRefValue<TrackLyricVariant | null | undefined>;
  playbackTime: ReadonlyRefValue<number>;
  isAudioPlaying: ReadonlyRefValue<boolean>;
  settings: ReadonlyRefValue<DesktopLyricsSettings>;
}

export function useDesktopLyricsSync({
  activeTrack,
  playbackLyricVariant,
  playbackTime,
  isAudioPlaying,
  settings,
}: UseDesktopLyricsSyncOptions) {
  function resolveDesktopLyricColor() {
    if (!settings.value.useThemeLyricColor) {
      return settings.value.lyricFontColor;
    }

    return getComputedStyle(document.documentElement)
      .getPropertyValue('--smw-lyrics-current')
      .trim() || settings.value.lyricFontColor;
  }

  async function broadcastCurrentDesktopLyricsState() {
    await broadcastDesktopLyricsState({
      track: activeTrack.value,
      lyricContent: playbackLyricVariant.value?.content ?? null,
      lyricFormat: playbackLyricVariant.value?.format ?? null,
      currentTime: playbackTime.value,
      isPlaying: isAudioPlaying.value,
      lyricColor: resolveDesktopLyricColor(),
    });
  }

  async function openDesktopLyrics() {
    await openDesktopLyricsWindow();
    await broadcastCurrentDesktopLyricsState();
  }

  async function toggleDesktopLyrics() {
    const window = await toggleDesktopLyricsWindow();
    if (window) await broadcastCurrentDesktopLyricsState();
  }

  watch(
    () => [
      activeTrack.value,
      playbackTime.value,
      isAudioPlaying.value,
      settings.value.useThemeLyricColor,
      settings.value.lyricFontColor,
      settings.value.theme,
    ] as const,
    () => {
      void broadcastCurrentDesktopLyricsState();
    },
    { immediate: true },
  );

  return {
    broadcastCurrentDesktopLyricsState,
    openDesktopLyrics,
    toggleDesktopLyrics,
  };
}
