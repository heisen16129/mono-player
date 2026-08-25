import { computed } from 'vue';
import type { LyricsViewListeners, LyricsViewProps } from '../types/lyricsView';

type LyricsViewPropSources = {
  [Key in Exclude<keyof LyricsViewProps, 'playerDockController'>]-?: () => LyricsViewProps[Key];
} & {
  playerDockController?: () => LyricsViewProps['playerDockController'];
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
    isFavorite: props.isFavorite(),
    isOpen: props.isOpen(),
    isPlayerDockHidden: props.isPlayerDockHidden(),
    lyricFormat: props.lyricFormat(),
    lyricsMetadata: props.lyricsMetadata(),
    lyricsStatus: props.lyricsStatus(),
    lyricsError: props.lyricsError(),
    playerDockController: props.playerDockController?.() ?? null,
  }));

  return {
    lyricsViewListeners: listeners,
    lyricsViewProps,
  };
}
