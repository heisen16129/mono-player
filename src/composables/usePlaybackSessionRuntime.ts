import type { ComputedRef, Ref } from 'vue';
import { usePlaybackSession } from './usePlaybackSession';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

interface UsePlaybackSessionRuntimeOptions {
  activeTrack: ComputedRef<Track | null>;
  playbackQueue: Ref<Track[]>;
  playbackTime: Ref<number>;
  player: ReturnType<typeof usePlayerStore>;
  selectedTrack: Ref<Track | null>;
}

export function usePlaybackSessionRuntime({
  activeTrack,
  playbackQueue,
  playbackTime,
  player,
  selectedTrack,
}: UsePlaybackSessionRuntimeOptions) {
  const playbackSession = usePlaybackSession({
    activeTrack,
    playbackQueue,
    playbackTime,
    player,
    selectedTrack,
  });

  return {
    ...playbackSession,
  };
}
