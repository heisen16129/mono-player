import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { t } from '../i18n';
import type { Locale, Track } from '../types/music';
import { artistLabel as formatArtistLabel } from '../utils/artist';

interface LyricsViewLabelsOptions {
  activeTrack: MaybeRefOrGetter<Track | null>;
  locale: MaybeRefOrGetter<Locale>;
}

export function useLyricsViewLabels(options: LyricsViewLabelsOptions) {
  const albumLabel = computed(() => toValue(options.activeTrack)?.album || t(toValue(options.locale), 'localMusic'));
  const artistLabel = computed(() => formatArtistLabel(toValue(options.activeTrack)?.artist, t(toValue(options.locale), 'unknownArtist')));
  const closeLabel = computed(() => t(toValue(options.locale), 'close'));
  const lyricsLabel = computed(() => t(toValue(options.locale), 'lyrics'));
  const lyricsLoadingLabel = computed(() => t(toValue(options.locale), 'lyricsLoading'));
  const titleLabel = computed(() => toValue(options.activeTrack)?.title || t(toValue(options.locale), 'unknownTrack'));

  return {
    albumLabel,
    artistLabel,
    closeLabel,
    lyricsLabel,
    lyricsLoadingLabel,
    titleLabel,
  };
}
