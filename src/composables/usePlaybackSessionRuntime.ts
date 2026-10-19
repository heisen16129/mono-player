import type { Ref } from 'vue';
import { usePlaybackSession } from './usePlaybackSession';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

interface UsePlaybackSessionRuntimeOptions {
  playbackTime: Ref<number>;
  player: ReturnType<typeof usePlayerStore>;
  selectedTrack: Ref<Track | null>;
}

export function usePlaybackSessionRuntime({
  playbackTime,
  player,
  selectedTrack,
}: UsePlaybackSessionRuntimeOptions) {
  const playbackSession = usePlaybackSession({
    playbackTime,
    player,
    selectedTrack,
  });

  return {
    ...playbackSession,
  };
}
