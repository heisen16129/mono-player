import { watch } from 'vue';
import type { Track } from '../types/music';
import { normalizePath } from '../utils/path';

interface RefValue<T> {
  value: T;
}

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLocalLibraryPlaybackCleanupOptions {
  libraryTracks: ReadonlyRefValue<Track[]>;
  currentPlaybackTrack: RefValue<Track | null>;
  selectedTrack: RefValue<Track | null>;
  onRemovedActiveLocalTrack: () => void;
}

export function useLocalLibraryPlaybackCleanup({
  libraryTracks,
  currentPlaybackTrack,
  selectedTrack,
  onRemovedActiveLocalTrack,
}: UseLocalLibraryPlaybackCleanupOptions) {
  function libraryTrackKey(track: Track) {
    return `${track.id}:${normalizePath(track.path)}`;
  }

  watch(
    () => libraryTracks.value.map(libraryTrackKey),
    (nextTrackKeys, previousTrackKeys) => {
      const nextKeys = new Set(nextTrackKeys);
      const removedTrackKeys = new Set(previousTrackKeys.filter((key) => !nextKeys.has(key)));
      if (
        (currentPlaybackTrack.value && removedTrackKeys.has(libraryTrackKey(currentPlaybackTrack.value)))
        || (selectedTrack.value && removedTrackKeys.has(libraryTrackKey(selectedTrack.value)))
      ) {
        onRemovedActiveLocalTrack();
      }
    },
  );
}
