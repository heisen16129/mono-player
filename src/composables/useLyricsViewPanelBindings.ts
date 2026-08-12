import { computed } from 'vue';
import type { LyricsActionMenuOverlayProps, LyricsSearchDialogOverlayProps, LyricsStageProps } from '../types/lyricsView';

type PropSources<T> = {
  [Key in keyof T]: () => T[Key];
};

interface UseLyricsViewPanelBindingsOptions {
  actionMenu: PropSources<LyricsActionMenuOverlayProps>;
  searchDialog: PropSources<LyricsSearchDialogOverlayProps>;
  stage: PropSources<LyricsStageProps>;
}

export function useLyricsViewPanelBindings({ actionMenu, searchDialog, stage }: UseLyricsViewPanelBindingsOptions) {
  const lyricsStageProps = computed<LyricsStageProps>(() => ({
    activeLyricIndex: stage.activeLyricIndex(),
    coverUrl: stage.coverUrl(),
    emptyMessage: stage.emptyMessage(),
    isEmpty: stage.isEmpty(),
    isPlayerDockHidden: stage.isPlayerDockHidden(),
    isLyricSyncOpen: stage.isLyricSyncOpen(),
    isLyricsPending: stage.isLyricsPending(),
    isScrolling: stage.isScrolling(),
    label: stage.label(),
    lines: stage.lines(),
    loadingText: stage.loadingText(),
    lyricWordProgress: stage.lyricWordProgress(),
    scrollThumbTop: stage.scrollThumbTop(),
    setLyricsPanelRef: stage.setLyricsPanelRef(),
  }));

  const lyricsActionMenuProps = computed<LyricsActionMenuOverlayProps>(() => ({
    downloadableLyricFormats: actionMenu.downloadableLyricFormats(),
    fontSize: actionMenu.fontSize(),
    hasAssociatedLyrics: actionMenu.hasAssociatedLyrics(),
    hasDownloadableCover: actionMenu.hasDownloadableCover(),
    hasLinkedLyrics: actionMenu.hasLinkedLyrics(),
    isFullscreen: actionMenu.isFullscreen(),
    isLyricSyncOpen: actionMenu.isLyricSyncOpen(),
    isOpen: actionMenu.isOpen(),
    isPlayerDockHidden: actionMenu.isPlayerDockHidden(),
    left: actionMenu.left(),
    linkedLyricsLabel: actionMenu.linkedLyricsLabel(),
    top: actionMenu.top(),
  }));

  const lyricsSearchDialogProps = computed<LyricsSearchDialogOverlayProps>(() => ({
    isLoadingMore: searchDialog.isLoadingMore(),
    isOpen: searchDialog.isOpen(),
    isSearching: searchDialog.isSearching(),
    providerId: searchDialog.providerId(),
    providers: searchDialog.providers(),
    resolvingTrackKey: searchDialog.resolvingTrackKey(),
    results: searchDialog.results(),
    status: searchDialog.status(),
    tabItems: searchDialog.tabItems(),
    trackKey: searchDialog.trackKey(),
  }));

  return {
    lyricsActionMenuProps,
    lyricsSearchDialogProps,
    lyricsStageProps,
  };
}
