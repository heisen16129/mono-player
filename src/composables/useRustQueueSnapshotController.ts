import type { Ref } from 'vue';
import type { RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import { isSameQueueSource } from '../utils/queueSource';
import { resolveRustQueueSnapshotTrack } from '../utils/rustQueueSnapshot';
import { mergeTrackRuntimeMetadata } from '../utils/trackRuntimeMetadata';

interface UseRustQueueSnapshotControllerOptions {
  currentPlaybackTrack: Ref<Track | null>;
  isAudioPlaying: Ref<boolean>;
  onlineActivePluginTrack: Ref<PluginSearchTrack | null>;
  onlineActiveTrack: Ref<Track | null>;
  onlineActiveTrackKey: Ref<string | null>;
  onlinePlaybackSource: Ref<string>;
  playbackTime: Ref<number>;
  queueSwitchingTrackKey: Ref<string | null>;
  rustPlaybackQueue: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
  clearQueueSwitchingForTrack: (track: Track | null) => void;
  dedupePlaybackQueue: (tracks: Track[]) => Track[];
  findPluginTrackForQueueTrack: (track: Track) => PluginSearchTrack | null;
  getOnlineTrackKey: (track: PluginSearchTrack) => string;
  loadLocalTrackLyricsInBackground: (track: Track) => Promise<void> | void;
  loadPlaybackTrackLyricsInBackground: (track: PluginSearchTrack, playbackTrack: Track) => Promise<void> | void;
  syncLyricsViewStateForTrack: (track: Track | null) => void;
}

export function useRustQueueSnapshotController({
  currentPlaybackTrack,
  isAudioPlaying,
  onlineActivePluginTrack,
  onlineActiveTrack,
  onlineActiveTrackKey,
  onlinePlaybackSource,
  playbackTime,
  queueSwitchingTrackKey,
  rustPlaybackQueue,
  selectedTrack,
  player,
  clearQueueSwitchingForTrack,
  dedupePlaybackQueue,
  findPluginTrackForQueueTrack,
  getOnlineTrackKey,
  loadLocalTrackLyricsInBackground,
  loadPlaybackTrackLyricsInBackground,
  syncLyricsViewStateForTrack,
}: UseRustQueueSnapshotControllerOptions) {
  function mergeQueueRuntimeMetadata(tracks: Track[]) {
    const candidates = [
      ...rustPlaybackQueue.value,
      ...(onlineActiveTrack.value ? [onlineActiveTrack.value] : []),
      ...(player.currentTrack ? [player.currentTrack] : []),
      ...(selectedTrack.value ? [selectedTrack.value] : []),
    ];
    return tracks.map((track) => mergeTrackRuntimeMetadata(track, candidates));
  }

  function handleSeamlessAdvance(track: Track) {
    const previousPlaybackTrack = currentPlaybackTrack.value;
    const isSamePlaybackTrack = previousPlaybackTrack
      ? isSameQueueSource(previousPlaybackTrack, track)
      : false;
    player.setCurrentTrack(track);
    const nextTrack = track;
    currentPlaybackTrack.value = nextTrack;
    const pluginTrack = findPluginTrackForQueueTrack(track);
    if (!isSamePlaybackTrack) {
      playbackTime.value = 0;
    }

    if (pluginTrack) {
      onlineActiveTrack.value = nextTrack;
      onlineActivePluginTrack.value = pluginTrack;
      onlinePlaybackSource.value = nextTrack.path;
      onlineActiveTrackKey.value = getOnlineTrackKey(pluginTrack);
      if (!isSamePlaybackTrack) {
        void loadPlaybackTrackLyricsInBackground(pluginTrack, nextTrack);
      }
    } else {
      onlineActiveTrack.value = null;
      onlineActivePluginTrack.value = null;
      onlinePlaybackSource.value = '';
      onlineActiveTrackKey.value = null;
      if (!isSamePlaybackTrack) {
        void loadLocalTrackLyricsInBackground(nextTrack);
      }
    }

    syncLyricsViewStateForTrack(nextTrack);
    selectedTrack.value = nextTrack;
    player.recordRecentlyPlayed(nextTrack);
  }

  function clearActivePlaybackState() {
    player.setCurrentTrack(null);
    currentPlaybackTrack.value = null;
    selectedTrack.value = null;
    onlineActiveTrack.value = null;
    onlineActivePluginTrack.value = null;
    onlinePlaybackSource.value = '';
    onlineActiveTrackKey.value = null;
    queueSwitchingTrackKey.value = null;
    playbackTime.value = 0;
    isAudioPlaying.value = false;
    syncLyricsViewStateForTrack(null);
  }

  function handleRustQueueSnapshot(snapshot: RustQueueSnapshot, markPreparing = true) {
    const mergedTracks = mergeQueueRuntimeMetadata(snapshot.tracks);
    rustPlaybackQueue.value = dedupePlaybackQueue(mergedTracks);
    const currentSource = snapshot.currentSource ?? '';
    const track = resolveRustQueueSnapshotTrack(snapshot, mergedTracks);
    if (track) {
      const pluginTrack = findPluginTrackForQueueTrack(track);
      const isSamePlaybackTrack = currentPlaybackTrack.value
        ? isSameQueueSource(currentPlaybackTrack.value, track)
        : false;
      if (markPreparing && pluginTrack && currentSource.startsWith('plugin://') && !isSamePlaybackTrack) {
        queueSwitchingTrackKey.value = getOnlineTrackKey(pluginTrack);
        playbackTime.value = 0;
        isAudioPlaying.value = false;
      } else {
        clearQueueSwitchingForTrack(track);
      }
      handleSeamlessAdvance(track);
      return;
    }

    if (!currentSource && rustPlaybackQueue.value.length === 0) {
      clearActivePlaybackState();
    }
  }

  return {
    clearActivePlaybackState,
    handleRustQueueSnapshot,
    handleSeamlessAdvance,
    mergeQueueRuntimeMetadata,
  };
}
