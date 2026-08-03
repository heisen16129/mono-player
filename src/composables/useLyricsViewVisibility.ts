import { ref } from 'vue';

export function useLyricsViewVisibility() {
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
    isLyricsOpen.value = true;
  }

  function showLibraryAfterLyricsLeave() {
    isLibraryVisible.value = true;
    isLyricsTransitioning.value = false;
  }

  function finishLyricsEnter() {
    isLyricsTransitioning.value = false;
  }

  return {
    closeLyricsView,
    finishLyricsEnter,
    isLibraryVisible,
    isLyricsOpen,
    isLyricsTransitioning,
    showLibraryAfterLyricsLeave,
    toggleLyricsView,
  };
}
