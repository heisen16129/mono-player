import { ref } from 'vue';
import { readCoverThumbnail } from '../services/music';
import type { Track } from '../types/music';
import { coverImageObjectUrl, revokeTemporaryObjectUrl, usableArtworkDisplaySrc } from '../utils/artwork';

export function useTrackMetadataCoverPreview() {
  const coverPreviewUrl = ref('');
  let coverLoadId = 0;
  let temporaryCoverUrl: string | null = null;

  function clearTemporaryCoverUrl() {
    revokeTemporaryObjectUrl(temporaryCoverUrl);
    temporaryCoverUrl = null;
  }

  function stopCoverPreviewLoading() {
    coverLoadId += 1;
    clearTemporaryCoverUrl();
  }

  async function loadCoverPreview(track: Track) {
    const currentLoadId = ++coverLoadId;
    clearTemporaryCoverUrl();

    const artworkUrl = usableArtworkDisplaySrc(track.artwork ?? track.associatedArtwork);
    if (artworkUrl) {
      coverPreviewUrl.value = artworkUrl;
      return;
    }

    coverPreviewUrl.value = '';
    const cover = await readCoverThumbnail(track.path).catch(() => null);
    if (currentLoadId !== coverLoadId) return;

    const objectUrl = coverImageObjectUrl(cover);
    if (!objectUrl) return;
    temporaryCoverUrl = objectUrl;
    coverPreviewUrl.value = objectUrl;
  }

  function handleCoverError() {
    coverPreviewUrl.value = '';
    clearTemporaryCoverUrl();
  }

  return {
    coverPreviewUrl,
    handleCoverError,
    loadCoverPreview,
    stopCoverPreviewLoading,
  };
}
