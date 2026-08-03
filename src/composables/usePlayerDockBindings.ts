import { computed } from 'vue';
import type { PlayerDockListeners, PlayerDockProps } from '../types/playerDock';

type PlayerDockPropSources = {
  [Key in keyof PlayerDockProps]: () => PlayerDockProps[Key];
};

interface UsePlayerDockBindingsOptions {
  listeners: PlayerDockListeners;
  props: PlayerDockPropSources;
}

export function usePlayerDockBindings({ listeners, props }: UsePlayerDockBindingsOptions) {
  const playerDockProps = computed<PlayerDockProps>(() => ({
    activeTrack: props.activeTrack(),
    canControlPlayback: props.canControlPlayback(),
    lyricsOpen: props.lyricsOpen(),
    isFavorite: props.isFavorite(),
    onlineQuality: props.onlineQuality(),
    onlineQualityOptions: props.onlineQualityOptions(),
    lyricFormat: props.lyricFormat(),
    lyricFormats: props.lyricFormats(),
    playbackMode: props.playbackMode(),
    playbackModeLabel: props.playbackModeLabel(),
    queue: props.queue(),
    restoreRequestId: props.restoreRequestId(),
    restoreTime: props.restoreTime(),
    seekRequestId: props.seekRequestId(),
    seekTime: props.seekTime(),
    isPreparingActiveTrack: props.isPreparingActiveTrack(),
    showActiveTrackDownload: props.showActiveTrackDownload(),
    isActiveTrackDownloaded: props.isActiveTrackDownloaded(),
    isActiveTrackDownloading: props.isActiveTrackDownloading(),
    showOnlineQuality: props.showOnlineQuality(),
    showLyricFormat: props.showLyricFormat(),
    sleepTimerRequest: props.sleepTimerRequest(),
    sleepTimerRequestId: props.sleepTimerRequestId(),
    togglePlaybackRequestId: props.togglePlaybackRequestId(),
  }));

  return {
    playerDockListeners: listeners,
    playerDockProps,
  };
}
