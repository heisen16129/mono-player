import { computed } from 'vue';
import type { LyricsViewListeners, LyricsViewProps } from '../types/lyricsView';

type LyricsViewPropSources = {
  [Key in keyof LyricsViewProps]-?: () => LyricsViewProps[Key];
};

interface UseLyricsViewBindingsOptions {
  listeners: LyricsViewListeners;
  props: LyricsViewPropSources;
}

export function useLyricsViewBindings({ listeners, props }: UseLyricsViewBindingsOptions) {
  const lyricsViewProps = computed<LyricsViewProps>(() => ({
    activeTrack: props.activeTrack(),
    currentTime: props.currentTime(),
    isPlaying: props.isPlaying(),
    isOpen: props.isOpen(),
    isPlayerDockHidden: props.isPlayerDockHidden(),
    lyricFormat: props.lyricFormat(),
    lyricsMetadata: props.lyricsMetadata(),
    lyricsStatus: props.lyricsStatus(),
    lyricsError: props.lyricsError(),
  }));

  return {
    lyricsViewListeners: listeners,
    lyricsViewProps,
  };
}
