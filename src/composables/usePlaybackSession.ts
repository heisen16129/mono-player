import { onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

type PlayerStore = ReturnType<typeof usePlayerStore>;

interface PlaybackSessionOptions {
  activeTrack: ComputedRef<Track | null>;
  playbackTime: Ref<number>;
  player: PlayerStore;
  playbackQueue?: Ref<Track[]>;
  selectedTrack: Ref<Track | null>;
}

export function usePlaybackSession({ activeTrack, playbackQueue, playbackTime, player, selectedTrack }: PlaybackSessionOptions) {
  const restorePlaybackRequestId = ref(0);
  const restorePlaybackTime = ref(0);
  let playbackSessionSaveTimer: number | undefined;

  function restoreSavedPlaybackSession() {
    const restored = player.restorePlaybackSession();
    if (!restored) return null;

    selectedTrack.value = restored.track;
    playbackTime.value = restored.currentTime;
    restorePlaybackTime.value = restored.currentTime;
    restorePlaybackRequestId.value += 1;
    return restored;
  }

  function savePlaybackSessionNow() {
    window.clearTimeout(playbackSessionSaveTimer);
    playbackSessionSaveTimer = undefined;
    player.persistPlaybackSession(playbackTime.value, activeTrack.value, playbackQueue?.value);
  }

  function schedulePlaybackSessionSave() {
    window.clearTimeout(playbackSessionSaveTimer);
    playbackSessionSaveTimer = window.setTimeout(savePlaybackSessionNow, 1000);
  }

  onMounted(() => {
    window.addEventListener('beforeunload', savePlaybackSessionNow);
    window.addEventListener('pagehide', savePlaybackSessionNow);
  });

  onBeforeUnmount(() => {
    savePlaybackSessionNow();
    window.clearTimeout(playbackSessionSaveTimer);
    window.removeEventListener('beforeunload', savePlaybackSessionNow);
    window.removeEventListener('pagehide', savePlaybackSessionNow);
  });

  watch(playbackTime, schedulePlaybackSessionSave);

  watch(
    () => activeTrack.value?.id,
    schedulePlaybackSessionSave,
  );

  watch(
    () => player.playbackMode,
    schedulePlaybackSessionSave,
  );

  watch(
    () => player.queue.map((track) => `${track.id}:${track.path}`).join('|'),
    schedulePlaybackSessionSave,
  );

  if (playbackQueue) {
    watch(
      () => playbackQueue.value.map((track) => `${track.id}:${track.path}`).join('|'),
      schedulePlaybackSessionSave,
    );
  }

  return {
    restorePlaybackRequestId,
    restorePlaybackTime,
    restoreSavedPlaybackSession,
    savePlaybackSessionNow,
    schedulePlaybackSessionSave,
  };
}
