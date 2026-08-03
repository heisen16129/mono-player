import { computed } from 'vue';
import type { Track } from '../types/music';
import type { PluginSearchTrack } from '../types/plugin';
import type { LibraryCollection, LibraryFilter } from './useLibraryNavigation';

interface ReadonlyRefValue<T> {
  readonly value: T;
}

interface UseActiveTrackUiStateOptions {
  activeCollection: ReadonlyRefValue<LibraryCollection>;
  activeLibraryFilter: ReadonlyRefValue<LibraryFilter>;
  activePlaylistId: ReadonlyRefValue<string | null>;
  activeTrack: ReadonlyRefValue<Track | null>;
  activeView: ReadonlyRefValue<string>;
  onlineActivePluginTrack: ReadonlyRefValue<PluginSearchTrack | null>;
  onlineActiveTrack: ReadonlyRefValue<Track | null>;
  playbackLyricFormats: ReadonlyRefValue<string[]>;
  pluginsEnabled: ReadonlyRefValue<boolean>;
  trackMetadataEditingEnabled: ReadonlyRefValue<boolean>;
  trackCoverEditingEnabled: ReadonlyRefValue<boolean>;
  trackDurationRefreshEnabled: ReadonlyRefValue<boolean>;
  findPluginTrackForQueueTrack: (track: Track) => PluginSearchTrack | null;
  isRemoteTrack: (track: Track) => boolean;
  isTrackDownloaded: (track: Track) => boolean;
  isTrackDownloadPending: (track: Track) => boolean;
}

export function useActiveTrackUiState({
  activeCollection,
  activeLibraryFilter,
  activePlaylistId,
  activeTrack,
  activeView,
  onlineActivePluginTrack,
  onlineActiveTrack,
  playbackLyricFormats,
  pluginsEnabled,
  trackMetadataEditingEnabled,
  trackCoverEditingEnabled,
  trackDurationRefreshEnabled,
  findPluginTrackForQueueTrack,
  isRemoteTrack,
  isTrackDownloaded,
  isTrackDownloadPending,
}: UseActiveTrackUiStateOptions) {
  const shouldShowLyricFormat = computed(() => {
    const active = activeTrack.value;
    return Boolean(
      playbackLyricFormats.value.length > 1
      && active
      && (findPluginTrackForQueueTrack(active) || !isRemoteTrack(active)),
    );
  });

  const shouldShowActiveTrackDownload = computed(() => Boolean(pluginsEnabled.value && onlineActiveTrack.value && onlineActivePluginTrack.value));
  const isActiveOnlineTrackDownloaded = computed(() => (
    onlineActiveTrack.value ? isTrackDownloaded(onlineActiveTrack.value) : false
  ));
  const isActiveOnlineTrackDownloading = computed(() => (
    onlineActiveTrack.value ? isTrackDownloadPending(onlineActiveTrack.value) : false
  ));
  const canUseLocalTrackContextActions = computed(() => (
    activeView.value === 'library'
    && activeCollection.value === 'all'
    && !activePlaylistId.value
    && activeLibraryFilter.value !== 'recentAdded'
    && activeLibraryFilter.value !== 'recentPlayed'
  ));
  const canEditTrackMetadata = computed(() => canUseLocalTrackContextActions.value && trackMetadataEditingEnabled.value);
  const canChangeTrackCover = computed(() => canUseLocalTrackContextActions.value && trackCoverEditingEnabled.value);
  const canRefreshTrackDuration = computed(() => canUseLocalTrackContextActions.value && trackDurationRefreshEnabled.value);

  return {
    canChangeTrackCover,
    canEditTrackMetadata,
    canRefreshTrackDuration,
    canUseLocalTrackContextActions,
    isActiveOnlineTrackDownloaded,
    isActiveOnlineTrackDownloading,
    shouldShowActiveTrackDownload,
    shouldShowLyricFormat,
  };
}
