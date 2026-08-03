<script setup lang="ts">
import AddToPlaylistDialogHeader from './AddToPlaylistDialogHeader.vue';
import AddToPlaylistDialogList from './AddToPlaylistDialogList.vue';
import BaseDialog from './BaseDialog.vue';
import { t } from '../i18n';
import type { Locale, Track, UserPlaylist } from '../types/music';

defineProps<{
  locale: Locale;
  playlists: UserPlaylist[];
  track: Track;
  tracksForPlaylist: (playlist: UserPlaylist) => Track[];
}>();

defineEmits<{
  close: [];
  createPlaylist: [];
  addTrack: [track: Track, playlist: UserPlaylist];
}>();
</script>

<template>
  <BaseDialog label="添加到歌单" :close-label="t(locale, 'close')" close-on-overlay overflow="hidden" header-padding="10px 12px" width="min(400px, calc(100vw - 32px))" @close="$emit('close')">
    <template #header>
      <AddToPlaylistDialogHeader title="添加到歌单" count-label="共 1 首" />
    </template>

      <AddToPlaylistDialogList
        :playlists="playlists"
        :tracks-for-playlist="tracksForPlaylist"
        @add-track="$emit('addTrack', track, $event)"
        @create-playlist="$emit('createPlaylist')"
      />
  </BaseDialog>
</template>
