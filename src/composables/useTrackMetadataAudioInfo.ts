import { ref } from 'vue';
import { readTrackAudioInfo } from '../services/music';
import type { TrackAudioInfo } from '../services/music';
import type { Track } from '../types/music';

export function useTrackMetadataAudioInfo() {
  const audioInfo = ref<TrackAudioInfo | null>(null);
  let audioInfoLoadId = 0;

  function stopAudioInfoLoading() {
    audioInfoLoadId += 1;
  }

  async function loadAudioInfo(track: Track) {
    const currentLoadId = ++audioInfoLoadId;
    audioInfo.value = null;

    const info = await readTrackAudioInfo({ path: track.path }).catch(() => null);
    if (currentLoadId !== audioInfoLoadId) return;
    audioInfo.value = info;
  }

  return {
    audioInfo,
    loadAudioInfo,
    stopAudioInfoLoading,
  };
}
