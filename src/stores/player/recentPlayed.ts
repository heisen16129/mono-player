import { ref } from 'vue';
import type { Track } from '../../types/music';
import { listRecentlyPlayedTracks } from '../../services/recentPlayed';

export function createRecentPlayedActions() {
  const recentPlayedTracks = ref<Track[]>([]);
  let pending: Promise<void> = Promise.resolve();
  function reloadRecentlyPlayed() {
    const operation = pending.then(async () => { recentPlayedTracks.value = await listRecentlyPlayedTracks(); });
    pending = operation.catch(() => {});
    return operation;
  }
  return { recentPlayedTracks, reloadRecentlyPlayed };
}
