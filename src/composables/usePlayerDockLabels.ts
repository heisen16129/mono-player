import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { t } from '../i18n';
import type { Locale } from '../types/music';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../types/plugin';

interface PlayerDockLabelsOptions {
  locale: MaybeRefOrGetter<Locale>;
  lyricFormat: MaybeRefOrGetter<string | null>;
  lyricFormats: MaybeRefOrGetter<string[]>;
  onlineQuality: MaybeRefOrGetter<PluginPlaybackQuality>;
  onlineQualityOptions: MaybeRefOrGetter<PluginPlaybackQualityOption[]>;
  playbackRate: MaybeRefOrGetter<number>;
}

export function usePlayerDockLabels(options: PlayerDockLabelsOptions) {
  const playbackLabel = computed(() => t(toValue(options.locale), 'playback'));
  const playbackRateLabel = computed(() => `${toValue(options.playbackRate)}x`);
  const onlineQualityLabel = computed(() => {
    const quality = toValue(options.onlineQuality);
    return toValue(options.onlineQualityOptions).find((option) => option.id === quality)?.name ?? quality;
  });
  const lyricFormatLabel = computed(() => {
    return toValue(options.lyricFormat)?.trim().toLowerCase() || toValue(options.lyricFormats)[0] || '';
  });

  return {
    lyricFormatLabel,
    onlineQualityLabel,
    playbackLabel,
    playbackRateLabel,
  };
}
