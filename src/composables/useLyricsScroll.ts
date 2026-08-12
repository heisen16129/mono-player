import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { LyricLine } from '../types/music';
import { useScrollingState } from './useScrollingState';

const LYRICS_SCROLL_MIN_DURATION = 320;
const LYRICS_SCROLL_MAX_DURATION = 560;
const LYRICS_SCROLL_DISTANCE_DURATION = 6;

type LyricsScrollBehavior = ScrollBehavior | 'animated';

export function useLyricsScroll(options: {
  activeLyricIndex: ComputedRef<number>;
  isLoadingLyrics: Ref<boolean>;
  lines: Ref<LyricLine[]>;
  lyricFontSize: Ref<number>;
  lyricTimeOffset: Ref<number>;
  getAnchorOffset?: () => number | null;
  onSeek: (time: number) => void;
}) {
  const lyricsPanel = ref<{ panel: HTMLElement | null } | null>(null);
  const isBrowsingLyrics = ref(false);
  const { hideScrolling: hideLyricsListScrolling, isScrolling: isLyricsListScrolling, showScrolling: showLyricsListScrolling } = useScrollingState();
  const scrollThumbTop = ref(0);
  let browseRestoreTimer = 0;
  let scrollAnimationFrame = 0;
  let scrollAnimationPanel: HTMLElement | null = null;
  let scrollAnimationStart = 0;
  let scrollAnimationTarget = 0;
  let scrollAnimationStartTime = 0;
  let scrollAnimationDuration = 0;

  async function scrollToActiveLyric(behavior: LyricsScrollBehavior = 'animated') {
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const panel = lyricsPanel.value?.panel ?? null;
    if (!panel) return;

    const centerHeight = syncLyricsPanelMetrics(panel);
    const currentLine = panel.querySelector<HTMLElement>('.current');
    if (!currentLine) return;

    const anchorOffset = options.getAnchorOffset?.();
    const anchorY = typeof anchorOffset === 'number' && Number.isFinite(anchorOffset) ? anchorOffset : centerHeight / 2;
    const nextTop = currentLine.offsetTop - anchorY + currentLine.clientHeight / 2;
    scrollLyricsPanelTo(panel, nextTop, behavior);
    requestAnimationFrame(syncScrollThumb);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelLyricScrollAnimation() {
    if (scrollAnimationFrame) {
      window.cancelAnimationFrame(scrollAnimationFrame);
      scrollAnimationFrame = 0;
    }
    scrollAnimationPanel = null;
    scrollAnimationStart = 0;
    scrollAnimationTarget = 0;
    scrollAnimationStartTime = 0;
    scrollAnimationDuration = 0;
  }

  function scrollLyricsPanelTo(panel: HTMLElement, top: number, behavior: LyricsScrollBehavior) {
    const maxScrollTop = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const targetTop = Math.min(maxScrollTop, Math.max(0, top));

    if (behavior !== 'animated' || prefersReducedMotion()) {
      const nativeBehavior: ScrollBehavior = behavior === 'animated' ? 'auto' : behavior;
      cancelLyricScrollAnimation();
      panel.scrollTo({ top: targetTop, behavior: nativeBehavior });
      return;
    }

    cancelLyricScrollAnimation();
    scrollAnimationPanel = panel;
    scrollAnimationStart = panel.scrollTop;
    scrollAnimationTarget = targetTop;
    scrollAnimationDuration = Math.min(
      LYRICS_SCROLL_MAX_DURATION,
      Math.max(LYRICS_SCROLL_MIN_DURATION, Math.abs(scrollAnimationTarget - scrollAnimationStart) * LYRICS_SCROLL_DISTANCE_DURATION),
    );
    scrollAnimationFrame = window.requestAnimationFrame(stepLyricScrollAnimation);
  }

  function stepLyricScrollAnimation(timestamp: number) {
    const panel = scrollAnimationPanel;
    if (!panel) {
      cancelLyricScrollAnimation();
      return;
    }

    if (!scrollAnimationStartTime) {
      scrollAnimationStartTime = timestamp;
      scrollAnimationFrame = window.requestAnimationFrame(stepLyricScrollAnimation);
      return;
    }

    const progress = Math.min(1, (timestamp - scrollAnimationStartTime) / scrollAnimationDuration);
    const easedProgress = easeOutCubic(progress);
    panel.scrollTop = scrollAnimationStart + (scrollAnimationTarget - scrollAnimationStart) * easedProgress;
    syncScrollThumb();

    if (progress >= 1) {
      panel.scrollTop = scrollAnimationTarget;
      syncScrollThumb();
      cancelLyricScrollAnimation();
      return;
    }

    scrollAnimationFrame = window.requestAnimationFrame(stepLyricScrollAnimation);
  }

  function easeOutCubic(progress: number) {
    return 1 - (1 - progress) ** 3;
  }

  function lyricsVisibleHeight(panel: HTMLElement) {
    return Math.max(1, panel.clientHeight);
  }

  function syncLyricsPanelMetrics(panel: HTMLElement) {
    const visibleHeight = lyricsVisibleHeight(panel);
    const anchorPadding = Math.max(32, visibleHeight / 2);
    panel.style.setProperty('--lyrics-anchor-padding-top', `${anchorPadding}px`);
    panel.style.setProperty('--lyrics-anchor-padding-bottom', `${anchorPadding}px`);
    return visibleHeight;
  }

  function beginLyricBrowse() {
    if (!options.lines.value.length) return;
    cancelLyricScrollAnimation();
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
      if (lyricsPanel.value.panel) syncLyricsPanelMetrics(lyricsPanel.value.panel);
      void syncLyricsToCurrentTime();
    }
  }

  function handleResize() {
    const panel = lyricsPanel.value?.panel ?? null;
    if (!panel) return;
    syncLyricsPanelMetrics(panel);
    void syncLyricsToCurrentTime();
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

  watch(options.lines, () => {
    const panel = lyricsPanel.value?.panel ?? null;
    if (!panel) return;
    syncLyricsPanelMetrics(panel);
  }, { flush: 'post' });

  watch(options.lyricFontSize, async () => {
    if (options.activeLyricIndex.value < 0) return;
    if (options.isLoadingLyrics.value) return;
    await scrollToActiveLyric('auto');
  }, { flush: 'post' });

  onMounted(() => {
    window.addEventListener('resize', handleResize);
  });

  onBeforeUnmount(() => {
    cancelLyricScrollAnimation();
    if (browseRestoreTimer) {
      window.clearTimeout(browseRestoreTimer);
    }
    window.removeEventListener('resize', handleResize);
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
