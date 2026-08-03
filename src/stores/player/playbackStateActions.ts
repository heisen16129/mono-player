import { computed, type Ref } from 'vue';
import { resolveLocale } from '../../i18n';
import { toAudioSource } from '../../services/music';
import type { PlaybackMode, PlayerSettings, Track } from '../../types/music';

interface PlayerPlaybackStateActionsOptions {
  currentTrack: Ref<Track | null>;
  persistSettings: () => void;
  playbackMode: Ref<PlaybackMode>;
  query: Ref<string>;
  settings: Ref<PlayerSettings>;
  tracks: Ref<Track[]>;
}

export function createPlayerPlaybackStateActions({
  currentTrack,
  persistSettings,
  playbackMode,
  query,
  settings,
  tracks,
}: PlayerPlaybackStateActionsOptions) {
  const filteredTracks = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase();
    if (!needle) return tracks.value;

    return tracks.value.filter((track) => {
      return [track.title, track.artist]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle));
    });
  });

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

  function recordRecentlyPlayed(track: Track | null) {
    if (!track?.path) return;

    settings.value.recentPlayedTrackIds = [
      track.id,
      ...settings.value.recentPlayedTrackIds.filter((id) => id !== track.id),
    ].slice(0, 100);
    persistSettings();
  }

  return {
    currentSource,
    filteredTracks,
    playbackModeLabel,
    recordRecentlyPlayed,
    setCurrentTrack,
    togglePlaybackMode,
  };
}
