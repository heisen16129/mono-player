<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue';
import { resolveLocale } from '../i18n';
import type { PlaylistContextMenuEmits, PlaylistContextMenuProps } from '../types/appContextMenus';
import BaseContextMenu from './BaseContextMenu.vue';
import ContextMenuAction from './ContextMenuAction.vue';

defineProps<PlaylistContextMenuProps>();

defineEmits<PlaylistContextMenuEmits>();
</script>

<template>
  <BaseContextMenu :x="menu.x" :y="menu.y" min-width="168px" :z-index="140">
    <ContextMenuAction @action="$emit('rename', menu.playlist)">
      <Pencil :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Rename playlist' : '重命名歌单' }}
    </ContextMenuAction>
    <ContextMenuAction @action="$emit('delete', menu.playlist)">
      <Trash2 :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Delete playlist' : '删除歌单' }}
    </ContextMenuAction>
  </BaseContextMenu>
</template>
