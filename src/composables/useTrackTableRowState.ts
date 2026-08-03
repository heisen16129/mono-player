import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import type { Track } from '../types/music';
import { downloadTrackKey } from '../utils/trackKey';

interface TrackTableRowStateOptions {
  downloadedTrackKeys?: MaybeRefOrGetter<string[] | undefined>;
  favoriteTrackIds: MaybeRefOrGetter<number[]>;
  isFavoriteTrack?: MaybeRefOrGetter<((track: Track) => boolean) | undefined>;
  pendingDownloadTrackKeys?: MaybeRefOrGetter<string[] | undefined>;
}

export function useTrackTableRowState(options: TrackTableRowStateOptions) {
  const favoriteTrackIdSet = computed(() => new Set(toValue(options.favoriteTrackIds)));
  const downloadedTrackKeySet = computed(() => new Set(toValue(options.downloadedTrackKeys) ?? []));
  const pendingDownloadTrackKeySet = computed(() => new Set(toValue(options.pendingDownloadTrackKeys) ?? []));

  function isFavoriteTrack(track: Track) {
    const customIsFavoriteTrack = toValue(options.isFavoriteTrack);
    if (customIsFavoriteTrack) return customIsFavoriteTrack(track);

    return favoriteTrackIdSet.value.has(track.id);
  }

  function isDownloadedTrack(track: Track) {
    return downloadedTrackKeySet.value.has(downloadTrackKey(track));
  }

  function isPendingDownloadTrack(track: Track) {
    return pendingDownloadTrackKeySet.value.has(downloadTrackKey(track));
  }

  function canDownloadTrack(track: Track) {
    return !isDownloadedTrack(track) && !isPendingDownloadTrack(track);
  }

  function getDownloadActionLabel(track: Track) {
    if (isDownloadedTrack(track)) return '已下载';
    if (isPendingDownloadTrack(track)) return '下载中';
    return '下载';
  }

  return {
    canDownloadTrack,
    getDownloadActionLabel,
    isDownloadedTrack,
    isFavoriteTrack,
    isPendingDownloadTrack,
  };
}
