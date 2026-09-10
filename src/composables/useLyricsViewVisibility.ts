import { ref } from 'vue';

export function useLyricsViewVisibility() {
  const hasOpenedLyrics = ref(false);
  const isLyricsOpen = ref(false);
  const isLyricsTransitioning = ref(false);
  const isLibraryVisible = ref(true);

  function closeLyricsView() {
    isLibraryVisible.value = true;
    isLyricsTransitioning.value = true;
    isLyricsOpen.value = false;
  }

  function toggleLyricsView() {
    if (isLyricsOpen.value) {
      closeLyricsView();
      return;
    }

    isLibraryVisible.value = true;
    isLyricsTransitioning.value = true;
    hasOpenedLyrics.value = true;
    isLyricsOpen.value = true;
  }

  function showLibraryAfterLyricsLeave() {
    isLibraryVisible.value = true;
    isLyricsTransitioning.value = false;
  }

  function finishLyricsEnter() {
    isLyricsTransitioning.value = false;
  }

  function preloadLyricsView() {
    hasOpenedLyrics.value = true;
  }

  return {
    closeLyricsView,
    finishLyricsEnter,
    hasOpenedLyrics,
    isLibraryVisible,
    isLyricsOpen,
    isLyricsTransitioning,
    preloadLyricsView,
    showLibraryAfterLyricsLeave,
    toggleLyricsView,
  };
}
