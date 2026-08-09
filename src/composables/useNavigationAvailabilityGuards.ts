import { watch } from 'vue';
import type { AppView } from './useLibraryNavigation';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseNavigationAvailabilityGuardsOptions {
  activeView: ReadonlyRefValue<AppView>;
  hasMusicSourcePlugin: ReadonlyRefValue<boolean>;
  pluginsEnabled: ReadonlyRefValue<boolean>;
  shouldShowDownloadsMenu: ReadonlyRefValue<boolean>;
  returnToLocalLibrary: () => void;
}

export function useNavigationAvailabilityGuards({
  activeView,
  hasMusicSourcePlugin,
  pluginsEnabled,
  shouldShowDownloadsMenu,
  returnToLocalLibrary,
}: UseNavigationAvailabilityGuardsOptions) {
  watch(
    () => pluginsEnabled.value,
    (enabled) => {
      if (enabled || !['discover', 'plugins'].includes(activeView.value)) return;
      returnToLocalLibrary();
    },
  );

  watch(
    () => hasMusicSourcePlugin.value,
    (available) => {
      if (available || activeView.value !== 'discover') return;
      returnToLocalLibrary();
    },
  );

  watch(
    () => shouldShowDownloadsMenu.value,
    (visible) => {
      if (visible || activeView.value !== 'downloads') return;
      returnToLocalLibrary();
    },
  );
}
