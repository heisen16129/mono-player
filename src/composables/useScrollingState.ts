import { onBeforeUnmount, ref } from 'vue';

export function useScrollingState(delay = 800) {
  const isScrolling = ref(false);
  let hideTimer: number | undefined;

  function showScrolling() {
    isScrolling.value = true;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      isScrolling.value = false;
      hideTimer = undefined;
    }, delay);
  }

  function hideScrolling() {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
    isScrolling.value = false;
  }

  onBeforeUnmount(() => {
    window.clearTimeout(hideTimer);
  });

  return {
    hideScrolling,
    isScrolling,
    showScrolling,
  };
}
