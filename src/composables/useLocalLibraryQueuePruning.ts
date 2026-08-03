import { watch } from 'vue';
import { removeRustBackendQueueSource, type RustQueueSnapshot } from '../services/playerBackend';
import type { Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import { normalizePath } from '../utils/path';
import { queueSourceKey } from '../utils/queueSource';

interface RefValue<T> {
  value: T;
}

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseLocalLibraryQueuePruningOptions {
  libraryTracks: ReadonlyRefValue<Track[]>;
  rustPlaybackQueue: RefValue<Track[]>;
  currentPlaybackTrack: RefValue<Track | null>;
  selectedTrack: RefValue<Track | null>;
  onRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  onRemovedActiveLocalTrack: () => void;
  showToast: (message: string) => void;
}

export function useLocalLibraryQueuePruning({
  libraryTracks,
  rustPlaybackQueue,
  currentPlaybackTrack,
  selectedTrack,
  onRustQueueSnapshot,
  onRemovedActiveLocalTrack,
  showToast,
}: UseLocalLibraryQueuePruningOptions) {
  function libraryTrackKey(track: Track) {
    return `${track.id}:${normalizePath(track.path)}`;
  }

  async function pruneRemovedLocalTracksFromQueue(removedTrackKeys: Set<string>) {
    if (removedTrackKeys.size === 0) return;

    const removedTracks: Track[] = [];
    const nextQueue = rustPlaybackQueue.value.filter((track) => {
      const removed = removedTrackKeys.has(libraryTrackKey(track));
      if (removed) removedTracks.push(track);
      return !removed;
    });

    if (
      (currentPlaybackTrack.value && removedTrackKeys.has(libraryTrackKey(currentPlaybackTrack.value)))
      || (selectedTrack.value && removedTrackKeys.has(libraryTrackKey(selectedTrack.value)))
    ) {
      onRemovedActiveLocalTrack();
    }

    if (removedTracks.length === 0) return;

    rustPlaybackQueue.value = nextQueue;
    for (const track of removedTracks) {
      try {
        onRustQueueSnapshot(await removeRustBackendQueueSource(queueSourceKey(track)));
      } catch (error) {
        showToast(getErrorMessage(error));
      }
    }
  }

  watch(
    () => libraryTracks.value.map(libraryTrackKey),
    (nextTrackKeys, previousTrackKeys) => {
      const nextKeys = new Set(nextTrackKeys);
      const removedTrackKeys = new Set(previousTrackKeys.filter((key) => !nextKeys.has(key)));
      void pruneRemovedLocalTracksFromQueue(removedTrackKeys);
    },
  );
}
