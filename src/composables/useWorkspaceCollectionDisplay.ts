import { computed, type Ref } from 'vue';
import { durationText, songCountLong, t } from '../i18n';
import type { Locale, Track } from '../types/music';

type ActiveCollection = 'all' | 'favorites';
type LibraryFilter = 'all' | 'recentAdded' | 'recentPlayed';

type WorkspaceCollectionDisplayOptions = {
  activeCollection: Ref<ActiveCollection>;
  activeTrack: Ref<Track | null>;
  isPlaylistView: Ref<boolean | undefined>;
  libraryFilter: Ref<LibraryFilter>;
  libraryMeta: Ref<{ count: number; minutes: number; totalSeconds: number }>;
  libraryTitle: Ref<string>;
  locale: Ref<Locale>;
  tracks: Ref<Track[]>;
};

function trackStats(locale: Locale, statistics: { count: number; totalSeconds: number }) {
  const totalMinutes = Math.round(statistics.totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration = durationText(locale, hours, minutes);

  return `${songCountLong(locale, statistics.count)} · ${duration} · ${t(locale, 'localLibrary')}`;
}

export function useWorkspaceCollectionDisplay(options: WorkspaceCollectionDisplayOptions) {
  const favoriteStats = computed(() => trackStats(options.locale.value, options.libraryMeta.value));
  const collectionStats = computed(() => trackStats(options.locale.value, options.libraryMeta.value));
  const isWideCollection = computed(() => true);

  const collectionTitle = computed(() => {
    if (options.activeCollection.value === 'favorites') return t(options.locale.value, 'favorites');
    if (options.libraryFilter.value === 'recentAdded') return t(options.locale.value, 'recentAdded');
    if (options.libraryFilter.value === 'recentPlayed') return t(options.locale.value, 'recentPlayed');
    return options.libraryTitle.value;
  });

  const collectionSubtitle = computed(() => {
    if (options.activeCollection.value === 'favorites') {
      return options.isPlaylistView.value ? collectionStats.value : favoriteStats.value;
    }
    if (options.libraryFilter.value === 'all') return songCountLong(options.locale.value, options.libraryMeta.value.count);
    return collectionStats.value;
  });

  const collectionDate = computed(() => {
    if (options.libraryFilter.value === 'all' && options.activeCollection.value !== 'favorites') return '2026-06-14';
    return '2026-06-15';
  });

  const collectionHeroId = computed(() => {
    if (options.activeCollection.value === 'favorites') return 'favorites';
    if (options.libraryFilter.value === 'recentAdded') return 'recent-added';
    if (options.libraryFilter.value === 'recentPlayed') return 'recent-played';
    return 'library';
  });

  const collectionEmptyText = computed(() => {
    if (options.activeCollection.value === 'favorites') return t(options.locale.value, 'emptyFavorites');
    if (options.libraryFilter.value === 'recentAdded') return t(options.locale.value, 'emptyRecentAdded');
    if (options.libraryFilter.value === 'recentPlayed') return t(options.locale.value, 'emptyRecentPlayed');
    return t(options.locale.value, 'emptySongs');
  });

  const hasPlayableVisibleTracks = computed(() => {
    return options.tracks.value.some((track) => track.path);
  });

  const canLocateActiveTrack = computed(() => {
    return Boolean(options.activeTrack.value && options.tracks.value.some((track) => track.id === options.activeTrack.value?.id));
  });

  return {
    canLocateActiveTrack,
    collectionDate,
    collectionEmptyText,
    collectionHeroId,
    collectionSubtitle,
    collectionTitle,
    hasPlayableVisibleTracks,
    isWideCollection,
  };
}
