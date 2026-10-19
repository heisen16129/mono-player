<script setup lang="ts">
import { Clock3, Download, History, Music2, ScanLine, UserRound } from '@lucide/vue';
import { computed } from 'vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { LibraryPanelEmits, LibraryPanelProps } from '../types/library';
import LibraryFolderEmptyState from './LibraryFolderEmptyState.vue';
import LibraryFolderRow from './LibraryFolderRow.vue';
import LibraryQuickRow from './LibraryQuickRow.vue';

const player = usePlayerStore();
const recentPlayedCount = computed(() => player.libraryListTotals.recentPlayedTracks.count);

defineProps<LibraryPanelProps>();

const emit = defineEmits<LibraryPanelEmits>();
</script>

<template>
  <aside class="library-panel">
    <div class="panel-title">
      <h1>{{ t(player.settings.locale, 'musicLibrary') }}</h1>
      <div class="panel-title-actions">
        <button class="icon-button" type="button" :title="t(player.settings.locale, 'allSongs')" :aria-label="t(player.settings.locale, 'allSongs')" @click="emit('openAll')">
          <Music2 :size="18" />
        </button>
        <button class="icon-button" type="button" :title="t(player.settings.locale, 'artists')" :aria-label="t(player.settings.locale, 'artists')" @click="emit('openArtists')">
          <UserRound :size="18" />
        </button>
      </div>
    </div>

    <div class="quick-list">
      <LibraryQuickRow
        :count-label="songCount(player.settings.locale, player.libraryListTotals.tracks.count)"
        :selected="!downloadsActive && !activeOnlineSearch && activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath"
        :title="t(player.settings.locale, 'allSongs')"
        @select="emit('openAll')"
      >
        <template #icon><Music2 :size="19" /></template>
      </LibraryQuickRow>
      <LibraryQuickRow
        :count-label="songCount(player.settings.locale, recentAddedCount)"
        :selected="!downloadsActive && activeLibraryFilter === 'recentAdded'"
        :title="t(player.settings.locale, 'recentAdded')"
        @select="emit('openRecentAdded')"
      >
        <template #icon><Clock3 :size="19" /></template>
      </LibraryQuickRow>
      <LibraryQuickRow
        :count-label="songCount(player.settings.locale, recentPlayedCount)"
        :selected="!downloadsActive && activeLibraryFilter === 'recentPlayed'"
        :title="t(player.settings.locale, 'recentPlayed')"
        @select="emit('openRecentPlayed')"
      >
        <template #icon><History :size="19" /></template>
      </LibraryQuickRow>
      <LibraryQuickRow
        v-if="showDownloads"
        count-label=""
        :selected="Boolean(downloadsActive)"
        title="下载管理"
        @select="emit('openDownloads')"
      >
        <template #icon><Download :size="19" /></template>
      </LibraryQuickRow>
    </div>

    <div class="divider"></div>

    <section class="playlist-section" id="folders">
      <div class="section-heading">
        <span>{{ t(player.settings.locale, 'localFolders') }}</span>
        <button class="icon-button" type="button" :title="t(player.settings.locale, 'scanLocalMusic')" @click="emit('openScanDialog')">
          <ScanLine :size="17" />
        </button>
      </div>

      <LibraryFolderRow
        v-for="folder in localFolders"
        :key="folder.path"
        :count-label="songCount(player.settings.locale, folder.count)"
        :folder="folder"
        :selected="!downloadsActive && activeFolderPath === folder.path"
        @open="emit('openFolder', $event)"
      />

      <LibraryFolderEmptyState v-if="localFolders.length === 0" :message="t(player.settings.locale, 'emptyFolders')" />
    </section>
  </aside>
</template>

<style scoped>
.library-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  min-height: 0;
  height: 100%;
  padding: 18px 20px 20px;
  overflow: hidden;
  border-right: 1px solid var(--smw-library-border);
  background: var(--smw-library-bg);
}

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

.panel-title-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-title-actions .icon-button {
  width: 28px;
  height: 28px;
}

.quick-list {
  display: grid;
  gap: 2px;
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

</style>
