import { ref, type Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface PlaybackSessionOptions {
  playbackTime: Ref<number>;
  player: PlayerStore;
  selectedTrack: Ref<Track | null>;
}

export function usePlaybackSession({ playbackTime, player, selectedTrack }: PlaybackSessionOptions) {
  const restorePlaybackRequestId = ref(0);
  const restorePlaybackTime = ref(0);

  function restoreSavedPlaybackSession() {
    const restored = player.restorePlaybackSession();
    if (!restored) return null;

    selectedTrack.value = restored.track;
    playbackTime.value = restored.currentTime;
    restorePlaybackTime.value = restored.currentTime;
    restorePlaybackRequestId.value += 1;
    return restored;
  }

  return {
    restorePlaybackRequestId,
    restorePlaybackTime,
    restoreSavedPlaybackSession,
  };
}
