import { ref } from 'vue';

export function usePlaybackRuntimeState() {
  const togglePlaybackRequestId = ref(0);
  const playbackTime = ref(0);
  const isAudioPlaying = ref(false);
  const seekRequestId = ref(0);
  const seekTime = ref(0);

  function updatePlaybackRunningState(isPlaying: boolean) {
    isAudioPlaying.value = isPlaying;
  }

  function updatePlaybackTime(value: number) {
    playbackTime.value = value;
  }

  return {
    isAudioPlaying,
    playbackTime,
    seekRequestId,
    seekTime,
    togglePlaybackRequestId,
    updatePlaybackRunningState,
    updatePlaybackTime,
  };
}
