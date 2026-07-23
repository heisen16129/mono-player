<script setup lang="ts">
import type { StyleValue } from 'vue';
import ArtistsView from './ArtistsView.vue';
import DiscoverMusicView from './DiscoverMusicView.vue';
import DownloadManagerView from './DownloadManagerView.vue';
import LibraryContentLayout from './LibraryContentLayout.vue';
import LibraryPanel from './LibraryPanel.vue';
import PluginManagerView from './PluginManagerView.vue';
import PluginSearchView from './PluginSearchView.vue';
import PrimarySidebar from './PrimarySidebar.vue';
import SettingsView from './SettingsView.vue';
import ThemeView from './ThemeView.vue';
import WorkspaceView from './WorkspaceView.vue';
import type { AppView, LibraryCollection, LibraryFilter } from '../composables/useLibraryNavigation';
import type { DownloadItem, Track, UserPlaylist } from '../types/music';
import type { PluginSearchProvider, PluginSearchTrack } from '../types/plugin';
import { createOnlineQueueTrack } from '../utils/onlineTrack';

interface LocalFolderItem {
  path: string;
  title: string;
  count: number;
  tracks: Track[];
  tone: 'desk' | 'night' | 'mist' | 'road';
}

interface ArtistGroup {
  name: string;
  tracks: Track[];
}

defineProps<{
  activeArtistName: string | null;
  activeCollection: LibraryCollection;
  activeFolderPath: string | null;
  activeLibraryFilter: LibraryFilter;
  activeOnlineProviderId: string | null;
  activePlaylistId: string | null;
  activeTrack: Track | null;
  activeView: AppView;
  appGridStyle: StyleValue;
  artistGroups: ArtistGroup[];
  downloadedTrackKeys: string[];
  downloadItems: DownloadItem[];
  enablePlugins: boolean;
  favoriteTrackIds: number[];
  isAudioPlaying: boolean;
  isLibraryPanelMode: boolean;
  isLibraryVisible: boolean;
  isOnlineLoadingMore: boolean;
  isOnlineSearchOpen: boolean;
  isOnlineSearching: boolean;
  isPreparingActiveTrack: boolean;
  isResizingLibraryPanel: boolean;
  isSidebarCollapsed: boolean;
  libraryMeta: { count: number; minutes: number };
  libraryTitle: string;
  localFolderTrackCount: number;
  localFolders: LocalFolderItem[];
  onlineLoadMoreError: string | null;
  onlinePreparingTrackKey: string | null;
  onlineSearchError: string | null;
  onlineSearchHasMore: boolean;
  onlineSearchProviders: PluginSearchProvider[];
  onlineSearchQuery: string;
  onlineSearchResults: PluginSearchTrack[];
  onlineActiveTrackKey: string | null;
  pendingDownloadTrackKeys: string[];
  playbackSpectrumLevels: number[];
  playerError: string | null;
  playerQuery: string;
  playlists: UserPlaylist[];
  recentAddedTrackCount: number;
  searchHistory: string[];
  shouldShowDownloadsMenu: boolean;
  shouldShowLibraryResizeHandle: boolean;
  visibleTracks: Track[];
}>();

defineEmits<{
  addDownloadedTrackToPlaylist: [item: DownloadItem];
  chooseFolder: [];
  clearDownloadedItemRecord: [item: DownloadItem];
  createPlaylist: [];
  deleteDownloadedItem: [item: DownloadItem];
  downloadTrack: [track: Track];
  loadMoreOnlineMusic: [retry: boolean];
  openArtistFromTrack: [artistName: string];
  openArtistsView: [];
  openDiscoverMusicView: [];
  openDownloadedItemFolder: [item: DownloadItem];
  openDownloadsView: [];
  openFavoritesView: [];
  openLocalFolderFromPanel: [path: string];
  openPlaylistContextMenu: [playlist: UserPlaylist, x: number, y: number];
  openPlaylistView: [playlistId: string];
  openPluginsView: [];
  openRecentAdded: [];
  openRecentAddedFromPanel: [];
  openRecentPlayed: [];
  openScanDialog: [];
  openSettingsView: [];
  openThemeView: [];
  notify: [message: string, variant?: 'success' | 'error'];
  openTrackContextMenu: [track: Track, x: number, y: number];
  openOnlineTrackContextMenu: [track: PluginSearchTrack, x: number, y: number];
  pauseDownloadItem: [item: DownloadItem];
  playDownloadedTrack: [track: Track];
  playFavoriteTracks: [];
  playOnlineTrack: [track: PluginSearchTrack];
  playTrack: [track: Track];
  queueDownloadedTrackNext: [item: DownloadItem];
  rescanLibrary: [];
  retryDownloadItem: [item: DownloadItem];
  resumeDownloadItem: [item: DownloadItem];
  returnToLocalLibrary: [];
  searchOnlineMusic: [keyword: string];
  selectArtist: [artistName: string];
  selectOnlineProvider: [providerId: string];
  selectTrack: [track: Track];
  startLibraryPanelResize: [event: PointerEvent];
  toggleFavoriteForTrack: [track: Track];
  toggleSidebarCollapsed: [];
  updateOnlineSearchQuery: [value: string];
  updatePlayerQuery: [value: string];
}>();
</script>

<template>
  <div
    v-if="isLibraryVisible"
    class="app-grid"
    :class="{
      'is-resizing-library-panel': isResizingLibraryPanel,
      'settings-grid': activeView === 'settings',
      'theme-grid': activeView === 'themes',
      'plugins-grid': activeView === 'plugins',
      'downloads-grid': activeView === 'downloads',
      'discover-grid': activeView === 'discover',
      'artists-grid': activeView === 'artists',
      'favorites-grid':
        activeView === 'library' &&
        (Boolean(activePlaylistId) || activeCollection === 'favorites' || (!isLibraryPanelMode && (activeLibraryFilter === 'recentAdded' || activeLibraryFilter === 'recentPlayed'))),
    }"
    :style="appGridStyle"
  >
    <PrimarySidebar
      :active-collection="activeCollection"
      :active-library-filter="isLibraryPanelMode && activeLibraryFilter === 'recentAdded' ? 'all' : activeLibraryFilter"
      :active-playlist-id="activePlaylistId"
      :active-view="activeView"
      :collapsed="isSidebarCollapsed"
      :enable-plugins="enablePlugins"
      :playlists="playlists ?? []"
      :show-downloads="shouldShowDownloadsMenu"
      @create-playlist="$emit('createPlaylist')"
      @open-playlist-menu="(playlist, x, y) => $emit('openPlaylistContextMenu', playlist, x, y)"
      @open-playlist="$emit('openPlaylistView', $event)"
      @open-library="$emit('returnToLocalLibrary')"
      @open-discover="$emit('openDiscoverMusicView')"
      @open-favorites="$emit('openFavoritesView')"
      @open-artists="$emit('openArtistsView')"
      @open-recent-added="$emit('openRecentAdded')"
      @open-recent-played="$emit('openRecentPlayed')"
      @open-downloads="$emit('openDownloadsView')"
      @open-plugins="$emit('openPluginsView')"
      @open-settings="$emit('openSettingsView')"
      @open-theme="$emit('openThemeView')"
      @toggle-collapsed="$emit('toggleSidebarCollapsed')"
    />

    <LibraryContentLayout v-if="activeView === 'library' && activeCollection === 'all' && isLibraryPanelMode">
      <template #panel>
        <LibraryPanel
          :active-collection="activeCollection"
          :active-folder-path="activeFolderPath"
          :active-library-filter="activeLibraryFilter"
          :active-online-search="isOnlineSearchOpen"
          :local-folders="localFolders"
          :recent-added-count="recentAddedTrackCount"
          :visible-track-count="localFolderTrackCount"
          @choose-folder="$emit('chooseFolder')"
          @open-all="$emit('returnToLocalLibrary')"
          @open-folder="$emit('openLocalFolderFromPanel', $event)"
          @open-recent-added="$emit('openRecentAddedFromPanel')"
          @open-scan-dialog="$emit('openScanDialog')"
        />
      </template>
      <template #detail>
        <PluginSearchView
          v-if="activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath && !activePlaylistId && isOnlineSearchOpen"
          :active-provider-id="activeOnlineProviderId"
          :active-playback-track="activeTrack"
          :active-track-key="onlineActiveTrackKey"
          :downloaded-track-keys="downloadedTrackKeys"
          :pending-download-track-keys="pendingDownloadTrackKeys"
          :error="onlineSearchError"
          :favorite-track-ids="favoriteTrackIds"
          :has-more="onlineSearchHasMore"
          :spectrum-levels="playbackSpectrumLevels"
          :is-playing="isAudioPlaying"
          :load-more-error="onlineLoadMoreError"
          :loading-more="isOnlineLoadingMore"
          :loading="isOnlineSearching"
          :providers="onlineSearchProviders"
          :query="onlineSearchQuery"
          :resolving-track-key="onlinePreparingTrackKey"
          :results="onlineSearchResults"
          @back-local="$emit('returnToLocalLibrary')"
          @download-track="$emit('downloadTrack', createOnlineQueueTrack($event))"
          @load-more="$emit('loadMoreOnlineMusic', false)"
          @open-track-menu="(track, x, y) => $emit('openOnlineTrackContextMenu', track, x, y)"
          @retry="$emit('searchOnlineMusic', onlineSearchQuery)"
          @retry-load-more="$emit('loadMoreOnlineMusic', true)"
          @search="$emit('searchOnlineMusic', $event)"
          @select-provider="$emit('selectOnlineProvider', $event)"
          @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
          @play-track="$emit('playOnlineTrack', $event)"
        />
        <WorkspaceView
          v-else
          :model-value="playerQuery"
          :active-collection="activeCollection"
          :active-track="activeTrack"
          :error="playerError"
          :favorite-track-ids="favoriteTrackIds"
          :preparing-track-id="isPreparingActiveTrack ? activeTrack?.id ?? null : null"
          :spectrum-levels="playbackSpectrumLevels"
          :is-playing="isAudioPlaying"
          :is-playlist-view="Boolean(activePlaylistId)"
          :library-filter="activeLibraryFilter"
          :library-meta="libraryMeta"
          :library-title="libraryTitle"
          :tracks="visibleTracks"
          :use-track-cover="Boolean(activeFolderPath)"
          @update:model-value="$emit('updatePlayerQuery', $event)"
          @choose-folder="$emit('chooseFolder')"
          @open-artist="$emit('openArtistFromTrack', $event)"
          @open-track-menu="(track, x, y) => $emit('openTrackContextMenu', track, x, y)"
          @play-favorite-tracks="$emit('playFavoriteTracks')"
          @play-visible-tracks="$emit('playFavoriteTracks')"
          @play-track="$emit('playTrack', $event)"
          @rescan="$emit('rescanLibrary')"
          @select-track="$emit('selectTrack', $event)"
          @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
        />
      </template>
    </LibraryContentLayout>

    <div
      v-if="shouldShowLibraryResizeHandle"
      class="library-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="调整音乐库侧栏宽度"
      @pointerdown="$emit('startLibraryPanelResize', $event)"
    ></div>

    <PluginSearchView
      v-if="activeView === 'discover' && activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath && !activePlaylistId && isOnlineSearchOpen"
      :active-provider-id="activeOnlineProviderId"
      :active-playback-track="activeTrack"
      :active-track-key="onlineActiveTrackKey"
      :downloaded-track-keys="downloadedTrackKeys"
      :pending-download-track-keys="pendingDownloadTrackKeys"
      :error="onlineSearchError"
      :favorite-track-ids="favoriteTrackIds"
      :has-more="onlineSearchHasMore"
      :spectrum-levels="playbackSpectrumLevels"
      :is-playing="isAudioPlaying"
      :load-more-error="onlineLoadMoreError"
      :loading-more="isOnlineLoadingMore"
      :loading="isOnlineSearching"
      :providers="onlineSearchProviders"
      :query="onlineSearchQuery"
      :resolving-track-key="onlinePreparingTrackKey"
      :results="onlineSearchResults"
      @back-local="$emit('returnToLocalLibrary')"
      @download-track="$emit('downloadTrack', createOnlineQueueTrack($event))"
      @load-more="$emit('loadMoreOnlineMusic', false)"
      @open-track-menu="(track, x, y) => $emit('openOnlineTrackContextMenu', track, x, y)"
      @retry="$emit('searchOnlineMusic', onlineSearchQuery)"
      @retry-load-more="$emit('loadMoreOnlineMusic', true)"
      @search="$emit('searchOnlineMusic', $event)"
      @select-provider="$emit('selectOnlineProvider', $event)"
      @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
      @play-track="$emit('playOnlineTrack', $event)"
    />
    <DiscoverMusicView
      v-else-if="activeView === 'discover'"
      :model-value="onlineSearchQuery"
      :search-history="searchHistory"
      @update:model-value="$emit('updateOnlineSearchQuery', $event)"
      @search="$emit('searchOnlineMusic', $event)"
    />
    <WorkspaceView
      v-else-if="activeView === 'library' && !(activeCollection === 'all' && isLibraryPanelMode)"
      :model-value="playerQuery"
      :active-collection="activeCollection"
      :active-track="activeTrack"
      :error="playerError"
      :favorite-track-ids="favoriteTrackIds"
      :preparing-track-id="isPreparingActiveTrack ? activeTrack?.id ?? null : null"
      :spectrum-levels="playbackSpectrumLevels"
      :is-playing="isAudioPlaying"
      :is-playlist-view="Boolean(activePlaylistId)"
      :library-filter="activeLibraryFilter"
      :library-meta="libraryMeta"
      :library-title="libraryTitle"
      :tracks="visibleTracks"
      :use-track-cover="Boolean(activeFolderPath)"
      @update:model-value="$emit('updatePlayerQuery', $event)"
      @choose-folder="$emit('chooseFolder')"
      @open-artist="$emit('openArtistFromTrack', $event)"
      @open-track-menu="(track, x, y) => $emit('openTrackContextMenu', track, x, y)"
      @play-favorite-tracks="$emit('playFavoriteTracks')"
      @play-visible-tracks="$emit('playFavoriteTracks')"
      @play-track="$emit('playTrack', $event)"
      @rescan="$emit('rescanLibrary')"
      @select-track="$emit('selectTrack', $event)"
      @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
    />
    <ArtistsView
      v-else-if="activeView === 'artists'"
      :model-value="playerQuery"
      :active-artist-name="activeArtistName"
      :active-track="activeTrack"
      :artist-groups="artistGroups"
      :favorite-track-ids="favoriteTrackIds"
      :spectrum-levels="playbackSpectrumLevels"
      :is-playing="isAudioPlaying"
      @update:model-value="$emit('updatePlayerQuery', $event)"
      @open-track-menu="(track, x, y) => $emit('openTrackContextMenu', track, x, y)"
      @play-track="$emit('playTrack', $event)"
      @select-artist="$emit('selectArtist', $event)"
      @select-track="$emit('selectTrack', $event)"
      @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
    />
    <DownloadManagerView
      v-else-if="activeView === 'downloads'"
      :active-track="activeTrack"
      :favorite-track-ids="favoriteTrackIds"
      :is-playing="isAudioPlaying"
      :items="downloadItems"
      @queue-next="$emit('queueDownloadedTrackNext', $event)"
      @add-to-playlist="$emit('addDownloadedTrackToPlaylist', $event)"
      @delete-download="$emit('deleteDownloadedItem', $event)"
      @clear-record="$emit('clearDownloadedItemRecord', $event)"
      @open-folder="$emit('openDownloadedItemFolder', $event)"
      @pause-download="$emit('pauseDownloadItem', $event)"
      @retry-download="$emit('retryDownloadItem', $event)"
      @resume-download="$emit('resumeDownloadItem', $event)"
      @play-track="$emit('playDownloadedTrack', $event)"
      @select-track="$emit('selectTrack', $event)"
      @toggle-favorite="$emit('toggleFavoriteForTrack', $event)"
    />
    <ThemeView v-else-if="activeView === 'themes'" />
    <PluginManagerView v-else-if="activeView === 'plugins'" @notify="(message, variant) => $emit('notify', message, variant)" />
    <SettingsView v-else-if="activeView === 'settings'" />
  </div>
</template>

<style scoped>
.library-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-width) + var(--library-width) - 4px);
  z-index: 12;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
}

.sidebar-collapsed .library-resize-handle {
  left: calc(var(--sidebar-collapsed-width) + var(--library-width) - 4px);
}

.library-resize-handle::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: transparent;
  content: '';
  transition: background 140ms ease, box-shadow 140ms ease;
}

.library-resize-handle:hover::after,
.app-grid.is-resizing-library-panel .library-resize-handle::after {
  background: var(--smw-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--smw-accent) 18%, transparent);
}

.app-grid.is-resizing-library-panel {
  transition: none;
}

:global(body.is-resizing-library-panel) {
  cursor: col-resize;
  user-select: none;
}
</style>
