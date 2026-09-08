import { onBeforeUnmount, watch } from 'vue';

const ROOT_CLASS = 'lyrics-desktop-transparent';

export function useLyricsWindowTransparency(enabled: () => boolean) {
  watch(
    enabled,
    (value) => {
      document.documentElement.classList.toggle(ROOT_CLASS, value);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    document.documentElement.classList.remove(ROOT_CLASS);
  });
}
