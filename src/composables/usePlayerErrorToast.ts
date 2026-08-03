import { watch } from 'vue';
import type { usePlayerStore } from '../stores/player';

interface UsePlayerErrorToastOptions {
  player: ReturnType<typeof usePlayerStore>;
  showToast: (message: string) => void;
}

export function usePlayerErrorToast({ player, showToast }: UsePlayerErrorToastOptions) {
  watch(
    () => player.error,
    (message) => {
      if (!message) return;
      showToast(message);
      player.error = null;
    },
  );
}
