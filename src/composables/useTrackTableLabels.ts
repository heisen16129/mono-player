import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { resolveLocale, t } from '../i18n';
import type { Locale } from '../types/music';

interface TrackTableLabelsOptions {
  locale: MaybeRefOrGetter<Locale>;
}

export function useTrackTableLabels(options: TrackTableLabelsOptions) {
  const albumLabel = computed(() => resolveLocale(toValue(options.locale)) === 'en-US' ? 'Album' : '专辑');
  const artistLabel = computed(() => t(toValue(options.locale), 'artist'));
  const localMusicLabel = computed(() => t(toValue(options.locale), 'localMusic'));
  const titleLabel = computed(() => resolveLocale(toValue(options.locale)) === 'en-US' ? 'Title' : '标题');
  const toggleFavoriteLabel = computed(() => t(toValue(options.locale), 'toggleFavorite'));
  const unknownArtistLabel = computed(() => t(toValue(options.locale), 'unknownArtist'));

  return {
    albumLabel,
    artistLabel,
    localMusicLabel,
    titleLabel,
    toggleFavoriteLabel,
    unknownArtistLabel,
  };
}
