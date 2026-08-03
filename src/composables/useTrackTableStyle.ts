import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';

interface TrackTableStyleOptions {
  extraColumns?: MaybeRefOrGetter<string | undefined>;
  hideActionsColumn?: MaybeRefOrGetter<boolean | undefined>;
}

export function useTrackTableStyle(options: TrackTableStyleOptions) {
  const trackTableStyle = computed(() => ({
    '--track-extra-columns': toValue(options.extraColumns) ?? '0px',
    '--track-actions-column': toValue(options.hideActionsColumn) ? '0px' : '54px',
  }));

  return {
    trackTableStyle,
  };
}
