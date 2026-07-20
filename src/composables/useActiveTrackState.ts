import { computed, ref, type ComputedRef } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';

export function useActiveTrackState({
  currentSource,
  isRemoteTrack,
  visibleTracks,
}: {
  currentSource: ComputedRef<string>;
  isRemoteTrack: (track: Track) => boolean;
  visibleTracks: ComputedRef<Track[]>;
}) {
  const selectedTrack = ref<Track | null>(null);
  const currentPlaybackTrack = ref<Track | null>(null);
  const rustPlaybackQueue = ref<Track[]>([]);
  const onlineActiveTrack = ref<Track | null>(null);
  const onlineActivePluginTrack = ref<PluginSearchTrack | null>(null);
  const onlinePlaybackSource = ref('');
  const onlineActiveTrackKey = ref<string | null>(null);
  const onlineResolvingTrackKey = ref<string | null>(null);
  const queueSwitchingTrackKey = ref<string | null>(null);

  const activeTrack = computed(() => {
    return currentPlaybackTrack.value ?? selectedTrack.value ?? visibleTracks.value[0] ?? null;
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

  const isPreparingActiveTrack = computed(() => Boolean(
    onlineActiveTrack.value
    && onlineActiveTrackKey.value
    && (
      onlineActiveTrackKey.value === onlineResolvingTrackKey.value
      || onlineActiveTrackKey.value === queueSwitchingTrackKey.value
    ),
  ));

  const onlinePreparingTrackKey = computed(() => onlineResolvingTrackKey.value ?? queueSwitchingTrackKey.value);

  return {
    activeTrack,
    currentPlaybackSource,
    currentPlaybackTrack,
    isPreparingActiveTrack,
    onlineActivePluginTrack,
    onlineActiveTrack,
    onlineActiveTrackKey,
    onlinePlaybackSource,
    onlinePreparingTrackKey,
    onlineResolvingTrackKey,
    queueSwitchingTrackKey,
    rustPlaybackQueue,
    selectedTrack,
    shouldShowOnlineQuality,
  };
}
