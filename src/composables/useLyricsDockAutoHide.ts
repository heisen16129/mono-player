import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Track } from '../types/music';

interface LyricsDockAutoHideOptions {
  activeTrack: ComputedRef<Track | null>;
  autoHideEnabled: ComputedRef<boolean>;
  isAudioPlaying: Ref<boolean>;
  isLyricsOpen: Ref<boolean>;
}

export function useLyricsDockAutoHide({ activeTrack, autoHideEnabled, isAudioPlaying, isLyricsOpen }: LyricsDockAutoHideOptions) {
  const isLyricsDockHovered = ref(false);
  const isLyricsDockManuallyHidden = ref(false);
  const isLyricsDockReadyToHide = ref(false);
  let lyricsDockHideTimer: number | null = null;

  const shouldAutoHideLyricsDock = computed(() => {
    return autoHideEnabled.value && isLyricsOpen.value && isAudioPlaying.value && isLyricsDockReadyToHide.value;
  });
  const isLyricsDockHidden = computed(() => {
    if (!isLyricsOpen.value) return false;
    if (isLyricsDockManuallyHidden.value) return true;
    return shouldAutoHideLyricsDock.value && !isLyricsDockHovered.value;
  });

  function clearLyricsDockHideTimer() {
    if (lyricsDockHideTimer === null) return;
    window.clearTimeout(lyricsDockHideTimer);
    lyricsDockHideTimer = null;
  }

  function scheduleLyricsDockHide() {
    clearLyricsDockHideTimer();
    isLyricsDockReadyToHide.value = false;

    if (!autoHideEnabled.value || !isLyricsOpen.value || !isAudioPlaying.value) {
      return;
    }

    lyricsDockHideTimer = window.setTimeout(() => {
      isLyricsDockReadyToHide.value = true;
      lyricsDockHideTimer = null;
    }, 10000);
  }

  function hoverLyricsDock() {
    isLyricsDockHovered.value = true;
  }

  function leaveLyricsDock() {
    isLyricsDockHovered.value = false;
  }

  function hideLyricsDock() {
    if (!isLyricsOpen.value) return;
    isLyricsDockManuallyHidden.value = true;
    isLyricsDockHovered.value = false;
  }

  function showLyricsDock() {
    isLyricsDockManuallyHidden.value = false;
    isLyricsDockReadyToHide.value = false;
    isLyricsDockHovered.value = false;
    scheduleLyricsDockHide();
  }

  watch(isAudioPlaying, (playing) => {
    if (!playing) {
      clearLyricsDockHideTimer();
      isLyricsDockReadyToHide.value = false;
      isLyricsDockHovered.value = false;
      return;
    }

    isLyricsDockHovered.value = false;
    scheduleLyricsDockHide();
  });

  watch(
    () => activeTrack.value?.id,
    () => {
      isLyricsDockManuallyHidden.value = false;
      scheduleLyricsDockHide();
      isLyricsDockHovered.value = false;
    },
  );

  watch(
    [isLyricsOpen, autoHideEnabled],
    ([open]) => {
      if (!open) {
        isLyricsDockManuallyHidden.value = false;
      }
      scheduleLyricsDockHide();
      isLyricsDockHovered.value = false;
    },
  );

  onBeforeUnmount(clearLyricsDockHideTimer);

  return {
    hideLyricsDock,
    hoverLyricsDock,
    isLyricsDockHidden,
    isLyricsDockManuallyHidden,
    leaveLyricsDock,
    showLyricsDock,
    shouldAutoHideLyricsDock,
  };
}
