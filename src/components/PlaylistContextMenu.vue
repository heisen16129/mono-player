<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue';
import { resolveLocale } from '../i18n';
import type { Locale, UserPlaylist } from '../types/music';
import BaseContextMenu from './BaseContextMenu.vue';

defineProps<{
  menu: { playlist: UserPlaylist; x: number; y: number };
  locale: Locale;
}>();

defineEmits<{
  rename: [playlist: UserPlaylist];
  delete: [playlist: UserPlaylist];
}>();
</script>

<template>
  <BaseContextMenu :x="menu.x" :y="menu.y" min-width="168px" :z-index="140">
    <button type="button" role="menuitem" @click="$emit('rename', menu.playlist)">
      <Pencil :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Rename playlist' : '重命名歌单' }}
    </button>
    <button type="button" role="menuitem" @click="$emit('delete', menu.playlist)">
      <Trash2 :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Delete playlist' : '删除歌单' }}
    </button>
  </BaseContextMenu>
</template>
