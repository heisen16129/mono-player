import { computed, type ComputedRef, type Ref } from 'vue';
import { useDesktopLyricsSync } from './useDesktopLyricsSync';
import { useLocalLyricsLoader } from './useLocalLyricsLoader';
import { useLyricsState } from './useLyricsState';
import { useOnlineLyricsLoader } from './useOnlineLyricsLoader';
import { usePlaybackLyricFormat } from './usePlaybackLyricFormat';
import { usePlaybackLyricsActions } from './usePlaybackLyricsActions';
import { useTrackLyricsMutation } from './useTrackLyricsMutation';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import type { OnlineToastVariant } from './useOnlineToast';

interface UsePlaybackLyricsRuntimeOptions {
  activeTrack: ComputedRef<Track | null>;
  currentPlaybackTrack: Ref<Track | null>;
  isAudioPlaying: Ref<boolean>;
  onlineActiveTrack: Ref<Track | null>;
  onlineActiveTrackKey: ReadonlyRefValue<string | null>;
  playbackTime: Ref<number>;
  player: ReturnType<typeof usePlayerStore>;
  rustPlaybackQueue: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  isRemoteTrack: (track: Track) => boolean;
  showToast: (message: string, variant?: OnlineToastVariant) => void;
}

interface ReadonlyRefValue<T> {
  readonly value: T;
}

export function usePlaybackLyricsRuntime({
  activeTrack,
  currentPlaybackTrack,
  isAudioPlaying,
  onlineActiveTrack,
  onlineActiveTrackKey,
  playbackTime,
  player,
  rustPlaybackQueue,
  selectedTrack,
  getOnlineTrackKey,
  isRemoteTrack,
  showToast,
}: UsePlaybackLyricsRuntimeOptions) {
  const {
    activeLyricsViewStatus,
    hasTrackSourceLyrics,
    lyricsTrackKey,
    lyricsViewState,
    syncLyricsViewStateForTrack,
    updateLyricsViewStateForRequest,
  } = useLyricsState(activeTrack);

  const {
    clearActiveTrackLyrics,
    updateActiveTrackLyrics,
    updateActiveTrackSourceLyrics,
  } = useTrackLyricsMutation({
    activeTrack,
    currentPlaybackTrack,
    onlineActiveTrack,
    player,
    rustPlaybackQueue,
    selectedTrack,
    syncLyricsViewStateForTrack,
    updateLyricsViewStateForRequest,
  });

  const {
    changeLyricFormat,
    registerPlaybackLyricActionContext,
    updateCurrentLocalTrackLyrics,
  } = usePlaybackLyricsActions({
    activeTrack,
    isRemoteTrack,
    onlineActiveTrack,
    player,
    selectedTrack,
    showToast,
  });

  const {
    loadLocalTrackLyricsInBackground,
    playbackLyricMetadata,
  } = useLocalLyricsLoader({
    activeTrack,
    applyLocalTrackLyrics: updateCurrentLocalTrackLyrics,
    isRemoteTrack,
    knownTracks: computed(() => [
      player.currentTrack,
      selectedTrack.value,
      ...rustPlaybackQueue.value,
      ...player.queue,
      ...player.tracks,
    ]),
    onlineActiveTrack,
    updateLyricsViewStateForRequest,
  });

  const {
    loadPlaybackTrackLyricsInBackground,
  } = useOnlineLyricsLoader({
    activeTrack,
    getOnlineTrackKey,
    hasTrackSourceLyrics,
    loadLocalTrackLyricsInBackground,
    onlineActiveTrackKey,
    updateActiveTrackSourceLyrics,
    updateLyricsViewStateForRequest,
  });

  const {
    playbackLyricFormat,
    playbackLyricFormats,
    playbackLyricVariant,
    setSelectedLyricFormat,
  } = usePlaybackLyricFormat({
    activeTrack,
    lyricsTrackKey,
    playbackLyricMetadata,
  });

  registerPlaybackLyricActionContext({
    playbackLyricFormat,
    playbackLyricMetadata,
    setSelectedLyricFormat,
  });

  const {
    broadcastCurrentDesktopLyricsState,
    openDesktopLyrics,
    toggleDesktopLyrics,
  } = useDesktopLyricsSync({
    activeTrack,
    isAudioPlaying,
    playbackLyricVariant,
    playbackTime,
    settings: computed(() => player.settings),
  });

  return {
    activeLyricsViewStatus,
    broadcastCurrentDesktopLyricsState,
    changeLyricFormat,
    clearActiveTrackLyrics,
    hasTrackSourceLyrics,
    loadLocalTrackLyricsInBackground,
    loadPlaybackTrackLyricsInBackground,
    lyricsTrackKey,
    lyricsViewState,
    openDesktopLyrics,
    toggleDesktopLyrics,
    playbackLyricFormat,
    playbackLyricFormats,
    playbackLyricMetadata,
    playbackLyricVariant,
    syncLyricsViewStateForTrack,
    updateActiveTrackLyrics,
    updateActiveTrackSourceLyrics,
  };
}
