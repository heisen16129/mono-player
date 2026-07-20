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
  const isLyricsDockReadyToHide = ref(false);
  let lyricsDockHideTimer: number | null = null;

  const shouldAutoHideLyricsDock = computed(() => {
    return autoHideEnabled.value && isLyricsOpen.value && isAudioPlaying.value && isLyricsDockReadyToHide.value;
  });
  const isLyricsDockHidden = computed(() => shouldAutoHideLyricsDock.value && !isLyricsDockHovered.value);

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
      scheduleLyricsDockHide();
      isLyricsDockHovered.value = false;
    },
  );

  watch(
    [isLyricsOpen, autoHideEnabled],
    () => {
      scheduleLyricsDockHide();
      isLyricsDockHovered.value = false;
    },
  );

  onBeforeUnmount(clearLyricsDockHideTimer);

  return {
    hoverLyricsDock,
    isLyricsDockHidden,
    leaveLyricsDock,
    shouldAutoHideLyricsDock,
  };
}
