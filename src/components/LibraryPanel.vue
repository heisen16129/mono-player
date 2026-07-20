<script setup lang="ts">
import { Clock3, Music2, ScanLine } from '@lucide/vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
import EmptyState from './EmptyState.vue';
import FolderCover from './FolderCover.vue';

const player = usePlayerStore();

interface LocalFolderItem {
  path: string;
  title: string;
  count: number;
  tracks: Track[];
  tone: 'desk' | 'night' | 'mist' | 'road';
}

defineProps<{
  activeCollection: 'all' | 'favorites';
  activeFolderPath: string | null;
  activeLibraryFilter: 'all' | 'recentAdded' | 'recentPlayed';
  activeOnlineSearch: boolean;
  localFolders: LocalFolderItem[];
  recentAddedCount: number;
  visibleTrackCount: number;
}>();

const emit = defineEmits<{
  chooseFolder: [];
  openAll: [];
  openFolder: [path: string];
  openRecentAdded: [];
  openScanDialog: [];
}>();
</script>

<template>
  <aside class="library-panel">
    <div class="panel-title">
      <h1>{{ t(player.settings.locale, 'musicLibrary') }}</h1>
    </div>

    <div class="quick-list">
      <button
        class="quick-row"
        :class="{ selected: !activeOnlineSearch && activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath }"
        type="button"
        @click="emit('openAll')"
      >
        <span><Music2 :size="19" /></span>
        <span class="quick-copy">
          <strong>{{ t(player.settings.locale, 'allSongs') }}</strong>
          <small>{{ songCount(player.settings.locale, visibleTrackCount) }}</small>
        </span>
      </button>
      <button
        class="quick-row"
        :class="{ selected: activeLibraryFilter === 'recentAdded' }"
        type="button"
        @click="emit('openRecentAdded')"
      >
        <span><Clock3 :size="19" /></span>
        <span class="quick-copy">
          <strong>{{ t(player.settings.locale, 'recentAdded') }}</strong>
          <small>{{ songCount(player.settings.locale, recentAddedCount) }}</small>
        </span>
      </button>
    </div>

    <div class="divider"></div>

    <section class="playlist-section" id="folders">
      <div class="section-heading">
        <span>{{ t(player.settings.locale, 'localFolders') }}</span>
        <button class="icon-button" type="button" :title="t(player.settings.locale, 'scanLocalMusic')" @click="emit('openScanDialog')">
          <ScanLine :size="17" />
        </button>
      </div>

      <button
        v-for="folder in localFolders"
        :key="folder.path"
        class="playlist-row"
        :class="{ selected: activeFolderPath === folder.path }"
        type="button"
        :title="folder.path"
        @click="emit('openFolder', folder.path)"
      >
        <FolderCover class="cover-mini" :tracks="folder.tracks" :tone="folder.tone" />
        <span>
          <strong>{{ folder.title }}</strong>
          <small>{{ songCount(player.settings.locale, folder.count) }}</small>
        </span>
      </button>

      <EmptyState v-if="localFolders.length === 0" class-name="empty-folder-note" :message="t(player.settings.locale, 'emptyFolders')" />
    </section>
  </aside>
</template>

<style scoped>
.panel-title,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.quick-list {
  display: grid;
  gap: 10px;
}

.quick-row,
.playlist-row {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.quick-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  column-gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 6px 8px;
  border-radius: 8px;
  text-align: left;
}

.quick-row:hover,
.quick-row.selected {
  background: var(--smw-bg-selected);
}

.quick-row > span:first-child {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

.quick-copy {
  display: grid;
  gap: 2px;
  align-content: center;
  min-width: 0;
}

.quick-row strong {
  font-size: 14px;
  font-weight: 520;
  line-height: 1.2;
}

.quick-row small {
  color: var(--smw-text-secondary);
  font-size: 13px;
  line-height: 1.2;
}

.divider {
  height: 1px;
  background: var(--smw-border);
}

.playlist-section {
  display: grid;
  gap: 8px;
  overflow: auto;
}

.section-heading {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.playlist-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 6px 8px;
  border-radius: 8px;
  text-align: left;
}

.playlist-row:hover,
.playlist-row.selected {
  background: var(--smw-bg-selected);
}

.playlist-row strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 520;
}

.playlist-row small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.empty-folder-note {
  margin: 4px 8px 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
