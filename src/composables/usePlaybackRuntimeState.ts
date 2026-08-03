import { ref } from 'vue';

export function usePlaybackRuntimeState() {
  const togglePlaybackRequestId = ref(0);
  const playbackTime = ref(0);
  const isAudioPlaying = ref(false);
  const playbackSpectrumLevels = ref<number[]>([]);
  const seekRequestId = ref(0);
  const seekTime = ref(0);

  function updatePlaybackRunningState(isPlaying: boolean) {
    isAudioPlaying.value = isPlaying;
  }

  function updatePlaybackSpectrum(levels: number[]) {
    playbackSpectrumLevels.value = levels;
  }

  function updatePlaybackTime(value: number) {
    playbackTime.value = value;
  }

  return {
    isAudioPlaying,
    playbackSpectrumLevels,
    playbackTime,
    seekRequestId,
    seekTime,
    togglePlaybackRequestId,
    updatePlaybackRunningState,
    updatePlaybackSpectrum,
    updatePlaybackTime,
  };
}
