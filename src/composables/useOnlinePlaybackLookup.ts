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
  dedupeTracks: (tracks: Track[]) => Track[];
}

export function useOnlinePlaybackLookup({
  activePluginTrack,
  onlineSearchResults,
  dedupeTracks,
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

  function buildOnlinePlaybackQueue(sourceTrack: PluginSearchTrack, playbackTrack: Track, queueTracks?: Track[]) {
    return buildOnlinePlaybackQueueFromTracks(sourceTrack, playbackTrack, {
      queueTracks,
      searchResults: onlineSearchResults.value,
      findPluginTrack: findPluginTrackForQueueTrack,
      dedupeTracks,
    });
  }

  return {
    buildOnlinePlaybackQueue,
    findPluginTrackForQueueTrack,
    getOnlineTrackKey,
  };
}
