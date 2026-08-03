import { computed, type Ref } from 'vue';
import { resolveLocale } from '../i18n';
import type { AppView, LibraryCollection } from './useLibraryNavigation';
import type { usePlayerStore } from '../stores/player';

interface UseAppShellStateOptions {
  activeCollection: Ref<LibraryCollection>;
  activeView: Ref<AppView>;
  isLibraryPanelMode: Ref<boolean>;
  player: ReturnType<typeof usePlayerStore>;
}

export function useAppShellState({ activeCollection, activeView, isLibraryPanelMode, player }: UseAppShellStateOptions) {
  const startupLoadingText = computed(() => (
    resolveLocale(player.settings.locale) === 'en-US'
      ? 'Loading music library...'
      : '正在加载音乐库...'
  ));

  const shouldShowLibraryResizeHandle = computed(() => {
    if (activeView.value === 'artists') return true;
    return activeView.value === 'library' && activeCollection.value === 'all' && isLibraryPanelMode.value;
  });

  const hasThemeBackground = computed(() => {
    return player.customThemes.some((theme) => theme.id === player.settings.theme && Boolean(theme.background));
  });

  return {
    hasThemeBackground,
    shouldShowLibraryResizeHandle,
    startupLoadingText,
  };
}
