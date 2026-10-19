import { computed, ref, type ComputedRef } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';

export function useActiveTrackState({
  currentSource,
  isRemoteTrack,
}: {
  currentSource: ComputedRef<string>;
  isRemoteTrack: (track: Track) => boolean;
}) {
  const selectedTrack = ref<Track | null>(null);
  const currentPlaybackTrack = ref<Track | null>(null);
  const rustPlaybackQueue = ref<Track[]>([]);
  const onlineActiveTrack = ref<Track | null>(null);
  const onlineActivePluginTrack = ref<PluginSearchTrack | null>(null);
  const onlinePlaybackSource = ref('');
  const onlineActiveTrackKey = ref<string | null>(null);
  const onlineResolvingTrackKey = ref<string | null>(null);

  const preparingTrack = computed(() => onlineResolvingTrackKey.value
    ? rustPlaybackQueue.value.find(track => `${track.sourceProviderId}:${track.sourceId}` === onlineResolvingTrackKey.value) ?? null
    : null);

  const activeTrack = computed(() => {
    return preparingTrack.value ?? currentPlaybackTrack.value ?? selectedTrack.value ?? null;
  });

  const currentPlaybackSource = computed(() => {
    if (onlineActiveTrack.value) return onlinePlaybackSource.value;
    return onlinePlaybackSource.value || currentSource.value;
  });

  const shouldShowOnlineQuality = computed(() => {
    return Boolean(
      onlineActiveTrack.value
      && onlineActivePluginTrack.value
      && isRemoteTrack(onlineActiveTrack.value),
    );
  });

  const isPreparingActiveTrack = computed(() => Boolean(preparingTrack.value));

  const onlinePreparingTrackKey = computed(() => onlineResolvingTrackKey.value);

  function clearPreparingPlaybackState() {
    onlineResolvingTrackKey.value = null;
  }

  return {
    activeTrack,
    clearPreparingPlaybackState,
    currentPlaybackSource,
    currentPlaybackTrack,
    isPreparingActiveTrack,
    onlineActivePluginTrack,
    onlineActiveTrack,
    onlineActiveTrackKey,
    onlinePlaybackSource,
    onlinePreparingTrackKey,
    onlineResolvingTrackKey,
    rustPlaybackQueue,
    selectedTrack,
    shouldShowOnlineQuality,
  };
}
