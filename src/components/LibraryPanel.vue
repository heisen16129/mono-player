<script setup lang="ts">
import { Clock3, Music2, ScanLine } from '@lucide/vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { LibraryPanelEmits, LibraryPanelProps } from '../types/library';
import LibraryFolderEmptyState from './LibraryFolderEmptyState.vue';
import LibraryFolderRow from './LibraryFolderRow.vue';
import LibraryQuickRow from './LibraryQuickRow.vue';

const player = usePlayerStore();

defineProps<LibraryPanelProps>();

const emit = defineEmits<LibraryPanelEmits>();
</script>

<template>
  <aside class="library-panel">
    <div class="panel-title">
      <h1>{{ t(player.settings.locale, 'musicLibrary') }}</h1>
    </div>

    <div class="quick-list">
      <LibraryQuickRow
        :count-label="songCount(player.settings.locale, visibleTrackCount)"
        :selected="!activeOnlineSearch && activeCollection === 'all' && activeLibraryFilter === 'all' && !activeFolderPath"
        :title="t(player.settings.locale, 'allSongs')"
        @select="emit('openAll')"
      >
        <template #icon><Music2 :size="19" /></template>
      </LibraryQuickRow>
      <LibraryQuickRow
        :count-label="songCount(player.settings.locale, recentAddedCount)"
        :selected="activeLibraryFilter === 'recentAdded'"
        :title="t(player.settings.locale, 'recentAdded')"
        @select="emit('openRecentAdded')"
      >
        <template #icon><Clock3 :size="19" /></template>
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
        :selected="activeFolderPath === folder.path"
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

.quick-list {
  display: grid;
  gap: 10px;
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
