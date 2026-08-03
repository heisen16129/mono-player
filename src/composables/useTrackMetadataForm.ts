import { computed, ref } from 'vue';
import type { Track } from '../types/music';

export interface TrackMetadataFormValue {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  trackNumber: string;
}

export function useTrackMetadataForm(track: Track) {
  const title = ref('');
  const artist = ref('');
  const album = ref('');
  const year = ref('');
  const genre = ref('');
  const trackNumber = ref('');

  const canSave = computed(() => title.value.trim().length > 0);

  resetForm(track);

  function resetForm(nextTrack: Track) {
    title.value = nextTrack.title ?? '';
    artist.value = nextTrack.artist ?? '';
    album.value = nextTrack.album ?? '';
    year.value = nextTrack.year ? String(nextTrack.year) : '';
    genre.value = nextTrack.genre ?? '';
    trackNumber.value = nextTrack.trackNumber ? String(nextTrack.trackNumber) : '';
  }

  function toFormValue(): TrackMetadataFormValue {
    return {
      title: title.value,
      artist: artist.value,
      album: album.value,
      year: year.value,
      genre: genre.value,
      trackNumber: trackNumber.value,
    };
  }

  return {
    album,
    artist,
    canSave,
    genre,
    resetForm,
    title,
    toFormValue,
    trackNumber,
    year,
  };
}
