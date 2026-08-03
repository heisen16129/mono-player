import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import type { Track } from '../types/music';
import { normalizePath } from '../utils/path';

interface TrackTableActiveRowOptions {
  activeTrack: MaybeRefOrGetter<Track | null>;
  trackKey?: MaybeRefOrGetter<((track: Track) => string | number) | undefined>;
}

export function useTrackTableActiveRow(options: TrackTableActiveRowOptions) {
  function getTrackKey(track: Track) {
    const customTrackKey = toValue(options.trackKey);
    if (customTrackKey) return customTrackKey(track);

    const path = normalizePath(track.path);
    return path ? `path:${path}` : `id:${track.id}`;
  }

  const activeTrackKey = computed(() => {
    const activeTrack = toValue(options.activeTrack);
    return activeTrack ? getTrackKey(activeTrack) : null;
  });

  function isActiveRow(track: Track) {
    return activeTrackKey.value === getTrackKey(track);
  }

  return {
    isActiveRow,
  };
}
