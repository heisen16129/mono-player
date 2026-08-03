import type { AppView, LibraryCollection } from './useLibraryNavigation';

export function isLibraryHomeOutlet(
  activeView: AppView,
  activeCollection: LibraryCollection,
  isLibraryPanelMode: boolean,
): boolean {
  return activeView === 'library' && activeCollection === 'all' && isLibraryPanelMode;
}

export function isWorkspaceOutlet(
  activeView: AppView,
  activeCollection: LibraryCollection,
  isLibraryPanelMode: boolean,
): boolean {
  return activeView === 'library' && !isLibraryHomeOutlet(activeView, activeCollection, isLibraryPanelMode);
}

export function isUtilityOutlet(activeView: AppView): boolean {
  return activeView === 'themes' || activeView === 'plugins' || activeView === 'settings';
}
