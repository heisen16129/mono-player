import { convertFileSrc } from '@tauri-apps/api/core';
import { ref } from 'vue';
import { readTrackCoverOriginal } from '../services/music';
import type { Track } from '../types/music';

export function useTrackMetadataCoverPreview() {
  const coverPreviewUrl = ref('');
  let loadRequestId = 0;

  async function loadCoverPreview(track: Track) {
    const requestId = ++loadRequestId;
    coverPreviewUrl.value = '';
    try {
      const originalPath = await readTrackCoverOriginal(track.path);
      if (requestId !== loadRequestId) return;
      coverPreviewUrl.value = originalPath ? convertFileSrc(originalPath) : '';
    } catch {
      if (requestId === loadRequestId) coverPreviewUrl.value = '';
    }
  }

  function handleCoverError() {
    coverPreviewUrl.value = '';
  }

  function stopCoverPreviewLoading() {
    loadRequestId += 1;
  }

  return {
    coverPreviewUrl,
    handleCoverError,
    loadCoverPreview,
    stopCoverPreviewLoading,
  };
}
