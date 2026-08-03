import { watch } from 'vue';
import type { AppView } from './useLibraryNavigation';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseNavigationAvailabilityGuardsOptions {
  activeView: ReadonlyRefValue<AppView>;
  pluginsEnabled: ReadonlyRefValue<boolean>;
  shouldShowDownloadsMenu: ReadonlyRefValue<boolean>;
  returnToLocalLibrary: () => void;
}

export function useNavigationAvailabilityGuards({
  activeView,
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
    () => shouldShowDownloadsMenu.value,
    (visible) => {
      if (visible || activeView.value !== 'downloads') return;
      returnToLocalLibrary();
    },
  );
}
