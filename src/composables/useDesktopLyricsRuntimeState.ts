import { ref } from 'vue';
import type { DesktopLyricsState } from '../services/desktopLyrics';
import type { Track } from '../types/music';
import { normalizeTrackLyrics } from '../utils/trackLyrics';

export function useDesktopLyricsRuntimeState() {
  const activeTrack = ref<Track | null>(null);
  const currentTime = ref(0);
  const isPlaying = ref(false);
  const lyricContent = ref<string | null>(null);
  const lyricFormat = ref<string | null>(null);
  const lyricColor = ref('#ff2c69');

  function trackLyricsKey(track: Track | null) {
    const lyrics = normalizeTrackLyrics(track);
    return `${track?.path ?? ''}\n${lyricContent.value ?? ''}\n${lyricFormat.value ?? ''}\n${lyrics?.defaultFormat ?? ''}`;
  }

  function applyDesktopLyricsState(state: DesktopLyricsState) {
    currentTime.value = state.currentTime;
    isPlaying.value = state.isPlaying;
    lyricColor.value = state.lyricColor || lyricColor.value;
    lyricContent.value = state.lyricContent;
    lyricFormat.value = state.lyricFormat;

    if (trackLyricsKey(activeTrack.value) !== trackLyricsKey(state.track)) {
      activeTrack.value = state.track;
    }
  }

  return {
    activeTrack,
    applyDesktopLyricsState,
    currentTime,
    isPlaying,
    lyricColor,
    lyricContent,
    lyricFormat,
  };
}
