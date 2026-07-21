import { ref } from 'vue';

const MIN_LYRIC_FONT_SIZE = 14;
const MAX_LYRIC_FONT_SIZE = 34;
const MENU_WIDTH = 204;
const MENU_HEIGHT = 284;

export function useLyricsActionMenu(options: {
  getFontSize: () => number;
  scrollToActiveLyric: () => void | Promise<void>;
  setFontSize: (size: number) => void;
}) {
  const isFontMenuOpen = ref(false);
  const isLyricSyncOpen = ref(false);
  const lyricTimeOffset = ref(0);
  const fontMenuLeft = ref(0);
  const fontMenuTop = ref(0);

  function setLyricFontSize(size: number) {
    options.setFontSize(Math.min(MAX_LYRIC_FONT_SIZE, Math.max(MIN_LYRIC_FONT_SIZE, size)));
    void options.scrollToActiveLyric();
  }

  function decreaseLyricFontSize() {
    setLyricFontSize(options.getFontSize() - 1);
  }

  function increaseLyricFontSize() {
    setLyricFontSize(options.getFontSize() + 1);
  }

  function closeFontMenu() {
    isFontMenuOpen.value = false;
  }

  function openLyricSyncControls() {
    isLyricSyncOpen.value = true;
    closeFontMenu();
  }

  function shiftLyricTiming(deltaSeconds: number) {
    lyricTimeOffset.value = Math.round((lyricTimeOffset.value + deltaSeconds) * 10) / 10;
    void options.scrollToActiveLyric();
  }

  function openFontMenu(event: MouseEvent) {
    fontMenuLeft.value = Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8);
    fontMenuTop.value = Math.min(event.clientY, window.innerHeight - MENU_HEIGHT - 8);
    isFontMenuOpen.value = true;
  }

  function closeFontMenuOnOutsidePointer(event: PointerEvent) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.lyrics-font-menu')) return;
    closeFontMenu();
  }

  return {
    closeFontMenu,
    closeFontMenuOnOutsidePointer,
    decreaseLyricFontSize,
    fontMenuLeft,
    fontMenuTop,
    increaseLyricFontSize,
    isFontMenuOpen,
    isLyricSyncOpen,
    lyricTimeOffset,
    openFontMenu,
    openLyricSyncControls,
    shiftLyricTiming,
  };
}
