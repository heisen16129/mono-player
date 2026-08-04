import { onBeforeUnmount, onMounted, type ComputedRef } from 'vue';
import type { ShortcutBindings } from '../types/music';
import { isEditableShortcutTarget, normalizeShortcutValue, shortcutFromKeyboardEvent, SHORTCUT_ACTIONS } from '../utils/shortcuts';

interface InAppShortcutActions {
  nextTrack: () => void;
  previousTrack: () => void;
  toggleDesktopLyrics: () => void;
  toggleFavorite: () => void;
  togglePlayback: () => void;
  togglePlaybackMode: () => void;
  volumeDown: () => void;
  volumeUp: () => void;
}

interface InAppShortcutsOptions {
  bindings: ComputedRef<ShortcutBindings>;
  enabled: ComputedRef<boolean>;
  actions: InAppShortcutActions;
}

const REPEATABLE_ACTIONS = new Set(['volumeDown', 'volumeUp']);

export function useInAppShortcuts({ actions, bindings, enabled }: InAppShortcutsOptions) {
  function handleKeydown(event: KeyboardEvent) {
    if (!enabled.value || isEditableShortcutTarget(event.target)) return;

    const shortcut = normalizeShortcutValue(shortcutFromKeyboardEvent(event));
    if (!shortcut) return;

    const action = SHORTCUT_ACTIONS.find((item) => normalizeShortcutValue(bindings.value[item]) === shortcut);
    if (!action) return;
    if (event.repeat && !REPEATABLE_ACTIONS.has(action)) return;

    event.preventDefault();
    actions[action]();
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
}
