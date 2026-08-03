import type { Ref } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import {
  buildOnlinePlaybackQueue as buildOnlinePlaybackQueueFromTracks,
  findPluginTrackForQueueTrack as findPluginTrackForQueueTrackFromCandidates,
} from '../utils/onlineTrack';
import { pluginSearchTrackKey } from '../utils/trackKey';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseOnlinePlaybackLookupOptions {
  activePluginTrack: ReadonlyRefValue<PluginSearchTrack | null>;
  onlineSearchResults: ReadonlyRefValue<PluginSearchTrack[]>;
  queueSwitchingTrackKey: Ref<string | null>;
  dedupeTracks: (tracks: Track[]) => Track[];
  mapPlaybackTrack: (track: Track) => Track;
}

export function useOnlinePlaybackLookup({
  activePluginTrack,
  onlineSearchResults,
  queueSwitchingTrackKey,
  dedupeTracks,
  mapPlaybackTrack,
}: UseOnlinePlaybackLookupOptions) {
  function getOnlineTrackKey(track: PluginSearchTrack) {
    return pluginSearchTrackKey(track);
  }

  function findPluginTrackForQueueTrack(track: Track) {
    return findPluginTrackForQueueTrackFromCandidates(track, {
      searchResults: onlineSearchResults.value,
      activePluginTrack: activePluginTrack.value,
    });
  }

  function onlineTrackKeyForQueueTrack(track: Track) {
    const pluginTrack = findPluginTrackForQueueTrack(track);
    return pluginTrack ? getOnlineTrackKey(pluginTrack) : null;
  }

  function clearQueueSwitchingForTrack(track: Track | null) {
    if (!track || queueSwitchingTrackKey.value !== onlineTrackKeyForQueueTrack(track)) return;
    queueSwitchingTrackKey.value = null;
  }

  function buildOnlinePlaybackQueue(sourceTrack: PluginSearchTrack, playbackTrack: Track, queueTracks?: Track[]) {
    return buildOnlinePlaybackQueueFromTracks(sourceTrack, playbackTrack, {
      queueTracks,
      searchResults: onlineSearchResults.value,
      findPluginTrack: findPluginTrackForQueueTrack,
      mapPlaybackTrack,
      dedupeTracks,
    });
  }

  function findNextOnlineSearchTrack(track: PluginSearchTrack) {
    const trackKey = getOnlineTrackKey(track);
    const index = onlineSearchResults.value.findIndex((item) => getOnlineTrackKey(item) === trackKey);
    if (index < 0) return null;
    return onlineSearchResults.value[index + 1] ?? null;
  }

  return {
    buildOnlinePlaybackQueue,
    clearQueueSwitchingForTrack,
    findNextOnlineSearchTrack,
    findPluginTrackForQueueTrack,
    getOnlineTrackKey,
    onlineTrackKeyForQueueTrack,
  };
}
