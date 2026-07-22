import { nextTick, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { LyricLine } from '../types/music';
import { useScrollingState } from './useScrollingState';

export function useLyricsScroll(options: {
  activeLyricIndex: ComputedRef<number>;
  isLoadingLyrics: Ref<boolean>;
  lines: Ref<LyricLine[]>;
  lyricTimeOffset: Ref<number>;
  onSeek: (time: number) => void;
}) {
  const lyricsPanel = ref<{ panel: HTMLElement | null } | null>(null);
  const isBrowsingLyrics = ref(false);
  const { hideScrolling: hideLyricsListScrolling, isScrolling: isLyricsListScrolling, showScrolling: showLyricsListScrolling } = useScrollingState();
  const scrollThumbTop = ref(0);
  let browseRestoreTimer = 0;

  async function scrollToActiveLyric(behavior: ScrollBehavior = 'smooth') {
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const panel = lyricsPanel.value?.panel ?? null;
    const currentLine = panel?.querySelector<HTMLElement>('.lyrics-panel .current');
    if (!panel || !currentLine) return;

    const nextTop = currentLine.offsetTop - panel.clientHeight / 2 + currentLine.clientHeight / 2;
    panel.scrollTo({ top: Math.max(0, nextTop), behavior });
    requestAnimationFrame(syncScrollThumb);
  }

  function beginLyricBrowse() {
    if (!options.lines.value.length) return;
    isBrowsingLyrics.value = true;
    if (browseRestoreTimer) {
      window.clearTimeout(browseRestoreTimer);
      browseRestoreTimer = 0;
    }
  }

  function scheduleRealtimeLyricsRestore() {
    beginLyricBrowse();
    browseRestoreTimer = window.setTimeout(() => {
      restoreRealtimeLyrics();
    }, 900);
  }

  function showLyricsScrollbarWhileScrolling() {
    if (!options.lines.value.length) return;
    showLyricsListScrolling();
  }

  function handleLyricsWheel() {
    showLyricsScrollbarWhileScrolling();
    scheduleRealtimeLyricsRestore();
  }

  function hideLyricsScrollbar() {
    hideLyricsListScrolling();
  }

  function restoreRealtimeLyrics() {
    if (browseRestoreTimer) {
      window.clearTimeout(browseRestoreTimer);
      browseRestoreTimer = 0;
    }

    if (!isBrowsingLyrics.value) return;
    isBrowsingLyrics.value = false;
    void scrollToActiveLyric();
  }

  function syncScrollThumb() {
    const panel = lyricsPanel.value?.panel ?? null;
    if (!panel) return;

    const maxScrollTop = panel.scrollHeight - panel.clientHeight;
    if (maxScrollTop <= 0) {
      scrollThumbTop.value = 0;
      return;
    }

    scrollThumbTop.value = (panel.scrollTop / maxScrollTop) * 154;
  }

  async function syncLyricsToCurrentTime() {
    if (options.activeLyricIndex.value < 0) return;
    if (isBrowsingLyrics.value) return;

    await scrollToActiveLyric('auto');
  }

  function seekToLyric(line: LyricLine) {
    if (line.time === null) return;
    options.onSeek(Math.max(0, line.time - options.lyricTimeOffset.value));
  }

  function setLyricsPanelRef(instance: unknown) {
    lyricsPanel.value = instance && typeof instance === 'object' && 'panel' in instance
      ? instance as { panel: HTMLElement | null }
      : null;

    if (lyricsPanel.value) {
      void syncLyricsToCurrentTime();
    }
  }

  watch(options.activeLyricIndex, async () => {
    if (options.activeLyricIndex.value < 0) return;
    if (options.isLoadingLyrics.value) return;
    if (isBrowsingLyrics.value) return;

    await scrollToActiveLyric();
  });

  watch(options.isLoadingLyrics, (loading) => {
    if (loading) return;
    void syncLyricsToCurrentTime();
  }, { flush: 'post' });

  onBeforeUnmount(() => {
    if (browseRestoreTimer) {
      window.clearTimeout(browseRestoreTimer);
    }
  });

  return {
    beginLyricBrowse,
    handleLyricsWheel,
    hideLyricsScrollbar,
    isBrowsingLyrics,
    isLyricsListScrolling,
    restoreRealtimeLyrics,
    scrollThumbTop,
    scrollToActiveLyric,
    seekToLyric,
    setLyricsPanelRef,
    syncLyricsToCurrentTime,
    syncScrollThumb,
  };
}
