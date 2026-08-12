import type { Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track, TrackLyrics } from '../types/music';
import type { LyricsViewListeners, LyricsViewProps } from '../types/lyricsView';
import type { PlayerDockListeners } from '../types/playerDock';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../types/plugin';
import { useLyricsViewBindings } from './useLyricsViewBindings';
import { usePlayerDockBindings } from './usePlayerDockBindings';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseAppPlayerSurfaceBindingsState {
  activeLyricsViewStatus: ReadonlyRefValue<LyricsViewProps['lyricsStatus']>;
  activeTrack: ReadonlyRefValue<Track | null>;
  currentPlaybackSource: ReadonlyRefValue<unknown>;
  isActiveOnlineTrackDownloaded: ReadonlyRefValue<boolean>;
  isActiveOnlineTrackDownloading: ReadonlyRefValue<boolean>;
  isActiveTrackFavorite: ReadonlyRefValue<boolean>;
  isAudioPlaying: Ref<boolean>;
  isLyricsDockManuallyHidden: ReadonlyRefValue<boolean>;
  isLyricsOpen: ReadonlyRefValue<boolean>;
  isPreparingActiveTrack: ReadonlyRefValue<boolean>;
  lyricsError: ReadonlyRefValue<string | null | undefined>;
  onlinePlaybackQuality: ReadonlyRefValue<PluginPlaybackQuality>;
  onlinePlaybackQualityOptions: ReadonlyRefValue<PluginPlaybackQualityOption[]>;
  playbackLyricFormat: ReadonlyRefValue<string | null>;
  playbackLyricFormats: ReadonlyRefValue<string[]>;
  playbackLyricMetadata: ReadonlyRefValue<TrackLyrics | null>;
  playbackTime: Ref<number>;
  restorePlaybackRequestId: ReadonlyRefValue<number>;
  restorePlaybackTime: ReadonlyRefValue<number>;
  rustPlaybackQueue: ReadonlyRefValue<Track[]>;
  seekRequestId: ReadonlyRefValue<number>;
  seekTime: ReadonlyRefValue<number>;
  shouldShowActiveTrackDownload: ReadonlyRefValue<boolean>;
  shouldShowLyricFormat: ReadonlyRefValue<boolean>;
  shouldShowOnlineQuality: ReadonlyRefValue<boolean>;
  togglePlaybackRequestId: ReadonlyRefValue<number>;
}

interface UseAppPlayerSurfaceBindingsActions {
  applyTrackCoverRefresh: (trackId: number, artwork?: string | null) => void;
  changeLyricFormat: PlayerDockListeners['onLyricFormatChange'];
  changeOnlinePlaybackQuality: PlayerDockListeners['onOnlineQualityChange'];
  clearActiveTrackLyrics: LyricsViewListeners['onLyricsCleared'];
  closeLyricsView: LyricsViewListeners['onClose'];
  downloadActiveOnlineTrack: PlayerDockListeners['onDownloadActiveTrack'];
  handlePlaybackFailure: PlayerDockListeners['onPlaybackError'];
  hideLyricsDock: LyricsViewListeners['onHidePlayerDock'];
  hoverLyricsDock: PlayerDockListeners['onMouseenter'];
  leaveLyricsDock: PlayerDockListeners['onMouseleave'];
  openDesktopLyrics: PlayerDockListeners['onOpenDesktopLyrics'];
  playActiveTrack: PlayerDockListeners['onRequestInitialPlayback'];
  playNextTrack: PlayerDockListeners['onPlayNext'];
  playPreviousTrack: PlayerDockListeners['onPlayPrevious'];
  playQueueTrack: PlayerDockListeners['onPlayQueueTrack'];
  seekToLyric: LyricsViewListeners['onSeek'];
  showLyricsDock: LyricsViewListeners['onShowPlayerDock'];
  showOnlineToast: LyricsViewListeners['onNotify'];
  toggleDesktopLyrics: PlayerDockListeners['onToggleDesktopLyrics'];
  toggleFavoriteTrack: PlayerDockListeners['onToggleFavorite'];
  toggleLyricsView: PlayerDockListeners['onOpenLyrics'];
  togglePlaybackMode: PlayerDockListeners['onTogglePlaybackMode'];
  updateActiveTrackLyrics: LyricsViewListeners['onLyricsFound'];
  updatePlaybackRunningState: PlayerDockListeners['onPlaybackStateChange'];
  updatePlaybackTime: PlayerDockListeners['onTimeChange'];
}

interface UseAppPlayerSurfaceBindingsOptions {
  player: ReturnType<typeof usePlayerStore>;
  state: UseAppPlayerSurfaceBindingsState;
  actions: UseAppPlayerSurfaceBindingsActions;
  handleSeamlessAdvance: PlayerDockListeners['onSeamlessAdvance'];
}

export function useAppPlayerSurfaceBindings({
  player,
  state,
  actions,
  handleSeamlessAdvance,
}: UseAppPlayerSurfaceBindingsOptions) {
  const { playerDockListeners, playerDockProps } = usePlayerDockBindings({
    props: {
      activeTrack: () => state.activeTrack.value,
      canControlPlayback: () => Boolean(state.currentPlaybackSource.value),
      lyricsOpen: () => state.isLyricsOpen.value,
      isFavorite: () => state.isActiveTrackFavorite.value,
      onlineQuality: () => state.onlinePlaybackQuality.value,
      onlineQualityOptions: () => state.onlinePlaybackQualityOptions.value,
      lyricFormat: () => state.playbackLyricFormat.value,
      lyricFormats: () => state.playbackLyricFormats.value,
      playbackMode: () => player.playbackMode,
      playbackModeLabel: () => player.playbackModeLabel,
      queue: () => state.rustPlaybackQueue.value,
      restoreRequestId: () => state.restorePlaybackRequestId.value,
      restoreTime: () => state.restorePlaybackTime.value,
      seekRequestId: () => state.seekRequestId.value,
      seekTime: () => state.seekTime.value,
      isPreparingActiveTrack: () => state.isPreparingActiveTrack.value,
      showActiveTrackDownload: () => state.shouldShowActiveTrackDownload.value,
      isActiveTrackDownloaded: () => state.isActiveOnlineTrackDownloaded.value,
      isActiveTrackDownloading: () => state.isActiveOnlineTrackDownloading.value,
      showOnlineQuality: () => state.shouldShowOnlineQuality.value,
      showLyricFormat: () => state.shouldShowLyricFormat.value && state.isLyricsOpen.value,
      togglePlaybackRequestId: () => state.togglePlaybackRequestId.value,
    },
    listeners: {
      onMouseenter: actions.hoverLyricsDock,
      onMouseleave: actions.leaveLyricsDock,
      onDownloadActiveTrack: actions.downloadActiveOnlineTrack,
      onOpenDesktopLyrics: actions.openDesktopLyrics,
      onToggleDesktopLyrics: actions.toggleDesktopLyrics,
      onOpenLyrics: actions.toggleLyricsView,
      onLyricFormatChange: actions.changeLyricFormat,
      onOnlineQualityChange: actions.changeOnlinePlaybackQuality,
      onPlayNext: actions.playNextTrack,
      onPlayPrevious: actions.playPreviousTrack,
      onPlayQueueTrack: actions.playQueueTrack,
      onPlaybackError: actions.handlePlaybackFailure,
      onPlaybackStateChange: actions.updatePlaybackRunningState,
      onRequestInitialPlayback: actions.playActiveTrack,
      onSeamlessAdvance: handleSeamlessAdvance,
      onTimeChange: actions.updatePlaybackTime,
      onToggleFavorite: actions.toggleFavoriteTrack,
      onTogglePlaybackMode: actions.togglePlaybackMode,
    },
  });

  const { lyricsViewListeners, lyricsViewProps } = useLyricsViewBindings({
    props: {
      activeTrack: () => state.activeTrack.value,
      currentTime: () => state.playbackTime.value,
      isPlaying: () => state.isAudioPlaying.value,
      isOpen: () => state.isLyricsOpen.value,
      isPlayerDockHidden: () => state.isLyricsDockManuallyHidden.value,
      lyricFormat: () => state.playbackLyricFormat.value,
      lyricsMetadata: () => state.playbackLyricMetadata.value,
      lyricsStatus: () => state.activeLyricsViewStatus.value,
      lyricsError: () => state.lyricsError.value,
    },
    listeners: {
      onClose: actions.closeLyricsView,
      onCoverChanged: (artwork) => {
        if (state.activeTrack.value) actions.applyTrackCoverRefresh(state.activeTrack.value.id, artwork);
      },
      onLyricsCleared: actions.clearActiveTrackLyrics,
      onLyricsFound: actions.updateActiveTrackLyrics,
      onNotify: actions.showOnlineToast,
      onHidePlayerDock: actions.hideLyricsDock,
      onShowPlayerDock: actions.showLyricsDock,
      onSeek: actions.seekToLyric,
    },
  });

  return {
    lyricsViewListeners,
    lyricsViewProps,
    playerDockListeners,
    playerDockProps,
  };
}
