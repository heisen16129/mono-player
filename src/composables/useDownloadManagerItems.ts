import { downloadRecordGroups } from './useDownloadState';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { Track } from '../types/music';
import { createDownloadTrack } from '../utils/downloadedTrack';

export type DownloadManagerTab = 'downloaded' | 'downloading';

export function useDownloadManagerItems(
  activeTab: MaybeRefOrGetter<DownloadManagerTab>,
) {
  const visibleItems = computed(() => downloadRecordGroups.value[toValue(activeTab)]);

  const visibleTracks = computed(() => visibleItems.value.map(createDownloadTrack));

  const itemByTrackId = computed(() => new Map(
    visibleTracks.value.map((track, index) => [track.id, visibleItems.value[index]]),
  ));

  function downloadItemForTrack(track: Track) {
    return itemByTrackId.value.get(track.id) ?? null;
  }

  return {
    downloadItemForTrack,
    visibleItems,
    visibleTracks,
  };
}
