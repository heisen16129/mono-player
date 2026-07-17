<script setup lang="ts">
import { Pencil, Trash2 } from '@lucide/vue';
import { resolveLocale } from '../i18n';
import type { Locale, UserPlaylist } from '../types/music';

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
  <div
    class="playlist-context-menu"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    role="menu"
    @click.stop
    @contextmenu.prevent.stop
  >
    <button type="button" role="menuitem" @click="$emit('rename', menu.playlist)">
      <Pencil :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Rename playlist' : '重命名歌单' }}
    </button>
    <button type="button" role="menuitem" @click="$emit('delete', menu.playlist)">
      <Trash2 :size="16" />
      {{ resolveLocale(locale) === 'en-US' ? 'Delete playlist' : '删除歌单' }}
    </button>
  </div>
</template>

<style scoped>
.playlist-context-menu {
  position: fixed;
  z-index: 140;
  display: grid;
  min-width: 168px;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: color-mix(in srgb, var(--smw-bg-workspace) 96%, transparent);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(12px);
}

.playlist-context-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.playlist-context-menu button:hover {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.playlist-context-menu svg {
  color: var(--smw-icon-muted);
}
</style>
