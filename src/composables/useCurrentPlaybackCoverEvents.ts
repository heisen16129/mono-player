import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import {
  listenRustBackendCoverChanged,
  type RustCoverChangedEvent,
} from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';

function normalizedPath(path: string) {
  return path.trim().replace(/\\/g, '/').toLocaleLowerCase();
}

function matchesLibraryTrack(track: Track, event: RustCoverChangedEvent) {
  return track.id === event.id || normalizedPath(track.path) === normalizedPath(event.path);
}

function matchesPlaybackTrack(track: Track, event: RustCoverChangedEvent) {
  return normalizedPath(track.path) === normalizedPath(event.path);
}

export function useCurrentPlaybackCoverEvents({
  currentPlaybackTrack,
  player,
}: {
  currentPlaybackTrack: Ref<Track | null>;
  player: ReturnType<typeof usePlayerStore>;
}) {
  let unlisten: (() => void) | null = null;
  let disposed = false;

  onMounted(async () => {
    const stopListening = await listenRustBackendCoverChanged((event) => {
      const currentTrack = currentPlaybackTrack.value;
      const patchTrack = (track: Track) => matchesLibraryTrack(track, event)
        ? {
          ...track,
          artwork: event.artwork,
          associatedArtwork: event.associatedArtwork,
          coverVersion: event.coverVersion,
        }
        : track;

      const updatesCurrentPlayback = currentTrack && matchesPlaybackTrack(currentTrack, event);
      if (updatesCurrentPlayback) {
        currentPlaybackTrack.value = patchTrack(currentTrack);
      }
      player.tracks = player.tracks.map(patchTrack);
      if (updatesCurrentPlayback && player.currentTrack && matchesPlaybackTrack(player.currentTrack, event)) {
        player.setCurrentTrack(patchTrack(player.currentTrack));
      }
    });

    if (disposed) {
      stopListening();
      return;
    }
    unlisten = stopListening;
  });

  onBeforeUnmount(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  });
}
