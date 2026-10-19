import { computed, type Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { toAudioSource } from '../../services/music';
import type { PlaybackMode, PlayerSettings, Track } from '../../types/music';

interface PlayerPlaybackStateActionsOptions {
  currentTrack: Ref<Track | null>;
  playbackMode: Ref<PlaybackMode>;
  settings: Ref<PlayerSettings>;
}

export function createPlayerPlaybackStateActions({
  currentTrack,
  playbackMode,
  settings,
}: PlayerPlaybackStateActionsOptions) {
  const currentSource = computed(() => {
    return currentTrack.value?.path ? toAudioSource(currentTrack.value.path) : '';
  });

  const playbackModeLabel = computed(() => {
    if (playbackMode.value === 'shuffle') return resolveLocale(settings.value.locale) === 'en-US' ? 'Shuffle' : '随机播放';
    if (playbackMode.value === 'repeat') return resolveLocale(settings.value.locale) === 'en-US' ? 'Repeat' : '循环播放';
    return resolveLocale(settings.value.locale) === 'en-US' ? 'Single track' : '固定播放';
  });

  function setCurrentTrack(track: Track | null) {
    currentTrack.value = track;
  }

  function togglePlaybackMode() {
    if (playbackMode.value === 'shuffle') {
      playbackMode.value = 'repeat';
      return;
    }

    if (playbackMode.value === 'repeat') {
      playbackMode.value = 'fixed';
      return;
    }

    playbackMode.value = 'shuffle';
  }

  return {
    currentSource,
    playbackModeLabel,
    setCurrentTrack,
    togglePlaybackMode,
  };
}
