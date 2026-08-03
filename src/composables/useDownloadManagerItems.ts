import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { DownloadItem, Track } from '../types/music';
import { createDownloadTrack } from '../utils/downloadedTrack';

export type DownloadManagerTab = 'downloaded' | 'downloading';

export function useDownloadManagerItems(
  items: MaybeRefOrGetter<DownloadItem[]>,
  activeTab: MaybeRefOrGetter<DownloadManagerTab>,
) {
  const visibleItems = computed(() => {
    const tab = toValue(activeTab);
    return toValue(items).filter((item) => {
      if (tab === 'downloaded') return item.status === 'downloaded';
      return item.status === 'downloading' || item.status === 'failed' || item.status === 'paused';
    });
  });

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
