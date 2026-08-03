import { computed } from 'vue';
import type { NowPlayingInfoProps, PlaybackMetaControlProps, TransportControlProps } from '../types/playerDock';

type PropSources<T> = {
  [Key in keyof T]: () => T[Key];
};

interface UsePlayerDockControlBindingsOptions {
  meta: PropSources<PlaybackMetaControlProps>;
  nowPlaying: PropSources<NowPlayingInfoProps>;
  transport: PropSources<TransportControlProps>;
}

export function usePlayerDockControlBindings({ meta, nowPlaying, transport }: UsePlayerDockControlBindingsOptions) {
  const playbackMetaControlProps = computed<PlaybackMetaControlProps>(() => ({
    activeTrack: meta.activeTrack(),
    isActiveTrackDownloaded: meta.isActiveTrackDownloaded(),
    isActiveTrackDownloading: meta.isActiveTrackDownloading(),
    isMuted: meta.isMuted(),
    isPlaying: meta.isPlaying(),
    isPreparingActiveTrack: meta.isPreparingActiveTrack(),
    isQueueOpen: meta.isQueueOpen(),
    locale: meta.locale(),
    lyricFormat: meta.lyricFormat(),
    lyricFormatLabel: meta.lyricFormatLabel(),
    lyricFormats: meta.lyricFormats(),
    onlineQuality: meta.onlineQuality(),
    onlineQualityLabel: meta.onlineQualityLabel(),
    onlineQualityOptions: meta.onlineQualityOptions(),
    playbackRate: meta.playbackRate(),
    playbackRateLabel: meta.playbackRateLabel(),
    queueTracks: meta.queueTracks(),
    showActiveTrackDownload: meta.showActiveTrackDownload(),
    showLyricFormat: meta.showLyricFormat(),
    showOnlineQuality: meta.showOnlineQuality(),
    showTrackCovers: meta.showTrackCovers(),
    showTrackNumbers: meta.showTrackNumbers(),
    sleepTimerAction: meta.sleepTimerAction(),
    sleepTimerExecuteAtLabel: meta.sleepTimerExecuteAtLabel(),
    sleepTimerHours: meta.sleepTimerHours(),
    isSleepTimerActive: meta.isSleepTimerActive(),
    isSleepTimerDialogOpen: meta.isSleepTimerDialogOpen(),
    isSleepTimerPaused: meta.isSleepTimerPaused(),
    isSleepTimerStatusOpen: meta.isSleepTimerStatusOpen(),
    sleepTimerMinutes: meta.sleepTimerMinutes(),
    sleepTimerPresetMinutes: meta.sleepTimerPresetMinutes(),
    sleepTimerProgressPercent: meta.sleepTimerProgressPercent(),
    sleepTimerRemainingLabel: meta.sleepTimerRemainingLabel(),
    spectrumLevels: meta.spectrumLevels(),
    volume: meta.volume(),
  }));

  const nowPlayingInfoProps = computed<NowPlayingInfoProps>(() => ({
    activeTrack: nowPlaying.activeTrack(),
    coverUrl: nowPlaying.coverUrl(),
    currentTime: nowPlaying.currentTime(),
    locale: nowPlaying.locale(),
    lyricsOpen: nowPlaying.lyricsOpen(),
    totalDurationLabel: nowPlaying.totalDurationLabel(),
  }));

  const transportControlProps = computed<TransportControlProps>(() => ({
    activeTrack: transport.activeTrack(),
    isFavorite: transport.isFavorite(),
    isPlaying: transport.isPlaying(),
    locale: transport.locale(),
    playbackMode: transport.playbackMode(),
    playbackModeLabel: transport.playbackModeLabel(),
  }));

  return {
    nowPlayingInfoProps,
    playbackMetaControlProps,
    transportControlProps,
  };
}
