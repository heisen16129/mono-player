import { ref } from 'vue';
import { cropCoverImage, updateTrackCover } from '../services/music';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';

interface CoverCropPayload {
  imageDataUrl?: string;
  x: number;
  y: number;
  size: number;
}

interface UseCoverCropDialogOptions {
  isTrackPlaying: (track: Track) => boolean;
  queueTrackCoverEmbed: (track: Track, coverPath: string) => void;
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

export function useCoverCropDialog({ isTrackPlaying, queueTrackCoverEmbed, showToast }: UseCoverCropDialogOptions) {
  const coverCropTrack = ref<Track | null>(null);
  const coverCropImagePath = ref('');
  const isSavingCoverCrop = ref(false);

  function openCoverCropDialog(track: Track, imagePath = '') {
    coverCropTrack.value = track;
    coverCropImagePath.value = imagePath;
  }

  function setCoverCropImagePath(imagePath: string) {
    coverCropImagePath.value = imagePath;
  }

  function closeCoverCropDialog() {
    if (isSavingCoverCrop.value) return;
    coverCropTrack.value = null;
    coverCropImagePath.value = '';
  }

  async function saveCoverCrop({ imageDataUrl, x, y, size }: CoverCropPayload) {
    const track = coverCropTrack.value;
    const imagePath = coverCropImagePath.value;
    if (!track || !imagePath) return;

    isSavingCoverCrop.value = true;
    try {
      const cropped = await cropCoverImage({ imageDataUrl, imagePath, x, y, size });
      const embedMetadata = !isTrackPlaying(track);
      await updateTrackCover({ trackId: track.id, path: track.path, coverPath: cropped.path, embedMetadata });
      if (!embedMetadata) {
        queueTrackCoverEmbed(track, cropped.path);
      }
      coverCropTrack.value = null;
      coverCropImagePath.value = '';
      showToast('封面已更新', 'success');
    } catch (error) {
      const message = getErrorMessage(error);
      showToast(`封面更新失败：${message}`);
    } finally {
      isSavingCoverCrop.value = false;
    }
  }

  return {
    closeCoverCropDialog,
    coverCropImagePath,
    coverCropTrack,
    isSavingCoverCrop,
    openCoverCropDialog,
    saveCoverCrop,
    setCoverCropImagePath,
  };
}
