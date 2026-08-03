import { removeRustBackendQueueSource, setRustBackendPlaybackMode, type RustQueueSnapshot } from '../services/playerBackend';
import type { usePlayerStore } from '../stores/player';
import type { PlaybackMode, Track } from '../types/music';
import { getErrorMessage } from '../utils/error';
import { queueSourceKey } from '../utils/queueSource';

interface UseRustQueueCommandsOptions {
  player: ReturnType<typeof usePlayerStore>;
  handleRustQueueSnapshot: (snapshot: RustQueueSnapshot) => void;
  showToast: (message: string, variant?: 'success' | 'error') => void;
}

export function useRustQueueCommands({
  player,
  handleRustQueueSnapshot,
  showToast,
}: UseRustQueueCommandsOptions) {
  async function syncRustPlaybackMode() {
    try {
      handleRustQueueSnapshot(await setRustBackendPlaybackMode(player.playbackMode));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function togglePlaybackMode() {
    player.togglePlaybackMode();
    await syncRustPlaybackMode();
  }

  async function setPlaybackMode(mode: PlaybackMode) {
    player.playbackMode = mode;
    await syncRustPlaybackMode();
  }

  async function removeTrackFromRustQueue(track: Track) {
    try {
      handleRustQueueSnapshot(await removeRustBackendQueueSource(queueSourceKey(track)));
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  }

  return {
    removeTrackFromRustQueue,
    setPlaybackMode,
    syncRustPlaybackMode,
    togglePlaybackMode,
  };
}
