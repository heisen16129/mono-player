import { onBeforeUnmount, onMounted } from 'vue';

interface LyricsViewInteractionOptions {
  clearLyricsCoverCache: () => void;
  closeFontMenu: () => void;
  closeFontMenuOnOutsidePointer: (event: PointerEvent) => void;
  closeFullscreenIfNeeded: () => Promise<void>;
  onClose: () => void;
  openFontMenu: (event: MouseEvent) => void;
  syncLyricsToCurrentTime: () => Promise<void> | void;
  toggleLyricsFullscreen: () => Promise<void> | void;
  updateFullscreenState: () => Promise<void> | void;
}

export function useLyricsViewInteractions(options: LyricsViewInteractionOptions) {
  async function closeLyricsView() {
    await options.closeFullscreenIfNeeded();
    options.onClose();
  }

  async function openActionMenu(event: MouseEvent) {
    await options.updateFullscreenState();
    options.openFontMenu(event);
  }

  function toggleFullscreen() {
    void options.toggleLyricsFullscreen();
    options.closeFontMenu();
  }

  onMounted(() => {
    document.addEventListener('pointerdown', options.closeFontMenuOnOutsidePointer);
    void options.updateFullscreenState();
    void options.syncLyricsToCurrentTime();
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', options.closeFontMenuOnOutsidePointer);
    options.clearLyricsCoverCache();
  });

  return {
    closeLyricsView,
    openActionMenu,
    toggleFullscreen,
  };
}
