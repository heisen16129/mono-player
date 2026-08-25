import { computed } from 'vue';
import type { LyricsRendererSearchDialogContext } from '../types/lyricsRenderer';

type PropSources<T> = {
  [Key in keyof T]: () => T[Key];
};

interface UseLyricsViewPanelBindingsOptions {
  searchDialog: PropSources<LyricsRendererSearchDialogContext>;
}

export function useLyricsViewPanelBindings({ searchDialog }: UseLyricsViewPanelBindingsOptions) {
  const lyricsRendererSearchDialog = computed<LyricsRendererSearchDialogContext>(() => ({
    apply: searchDialog.apply(),
    close: searchDialog.close(),
    isLoadingMore: searchDialog.isLoadingMore(),
    isOpen: searchDialog.isOpen(),
    isSearching: searchDialog.isSearching(),
    providerId: searchDialog.providerId(),
    providers: searchDialog.providers(),
    query: searchDialog.query(),
    resolvingTrackKey: searchDialog.resolvingTrackKey(),
    results: searchDialog.results(),
    scroll: searchDialog.scroll(),
    search: searchDialog.search(),
    selectProvider: searchDialog.selectProvider(),
    status: searchDialog.status(),
    tabItems: searchDialog.tabItems(),
    trackKey: searchDialog.trackKey(),
    updateQuery: searchDialog.updateQuery(),
  }));

  return {
    lyricsRendererSearchDialog,
  };
}
