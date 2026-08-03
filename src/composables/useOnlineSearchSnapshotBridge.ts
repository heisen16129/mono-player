import { computed, ref } from 'vue';
import type { OnlineSearchSnapshot } from '../types/onlineSearch';

const emptyOnlineSearchSnapshot: OnlineSearchSnapshot = {
  activeProviderId: null,
  isOpen: false,
  query: '',
  results: [],
};

export function useOnlineSearchSnapshotBridge() {
  const onlineSearchSnapshot = ref<OnlineSearchSnapshot>({ ...emptyOnlineSearchSnapshot });
  const onlineSearchError = ref<string | null>(null);
  const isOnlineSearchOpen = computed(() => onlineSearchSnapshot.value.isOpen);
  const onlineSearchResults = computed(() => onlineSearchSnapshot.value.results);

  function updateOnlineSearchSnapshot(snapshot: OnlineSearchSnapshot) {
    onlineSearchSnapshot.value = snapshot;
  }

  function resetOnlineSearchSnapshot() {
    onlineSearchSnapshot.value = { ...emptyOnlineSearchSnapshot };
    onlineSearchError.value = null;
  }

  function clearOnlineSearchError() {
    onlineSearchError.value = null;
  }

  function setOnlineSearchError(message: string | null) {
    onlineSearchError.value = message;
  }

  return {
    clearOnlineSearchError,
    isOnlineSearchOpen,
    onlineSearchError,
    onlineSearchResults,
    onlineSearchSnapshot,
    resetOnlineSearchSnapshot,
    setOnlineSearchError,
    updateOnlineSearchSnapshot,
  };
}
