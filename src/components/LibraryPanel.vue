<script setup lang="ts">
import { Clock3, Music2, ScanLine } from '@lucide/vue';
import { songCount, t } from '../i18n';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../types/music';
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

      <p v-if="localFolders.length === 0" class="empty-folder-note">{{ t(player.settings.locale, 'emptyFolders') }}</p>
    </section>
  </aside>
</template>
