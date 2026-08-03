import type { AppView, LibraryCollection, LibraryFilter } from './useLibraryNavigation';

export type AppLayoutVariant = 'default' | 'settings' | 'theme' | 'plugins' | 'downloads' | 'discover' | 'artists' | 'favorites';

export function resolveAppLayoutVariant(
  activeView: AppView,
  activePlaylistId: string | null,
  activeCollection: LibraryCollection,
  isLibraryPanelMode: boolean,
  activeLibraryFilter: LibraryFilter,
): AppLayoutVariant {
  if (activeView === 'settings') return 'settings';
  if (activeView === 'themes') return 'theme';
  if (activeView === 'plugins') return 'plugins';
  if (activeView === 'downloads') return 'downloads';
  if (activeView === 'discover') return 'discover';
  if (activeView === 'artists') return 'artists';
  if (
    activeView === 'library'
    && (Boolean(activePlaylistId) || activeCollection === 'favorites' || (!isLibraryPanelMode && (activeLibraryFilter === 'recentAdded' || activeLibraryFilter === 'recentPlayed')))
  ) {
    return 'favorites';
  }
  return 'default';
}
