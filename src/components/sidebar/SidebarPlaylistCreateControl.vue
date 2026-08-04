<script setup lang="ts">
import { Plus } from '@lucide/vue';
import type { SidebarPlaylistCreateControlEmits, SidebarPlaylistCreateControlProps } from '../../types/sidebar';

defineProps<SidebarPlaylistCreateControlProps>();

const emit = defineEmits<SidebarPlaylistCreateControlEmits>();
</script>

<template>
  <span class="nav-section-break" :class="{ 'is-collapsed': collapsed }">
    <span class="nav-divider" aria-hidden="true"></span>
    <button
      class="nav-add-button"
      type="button"
      :aria-label="locale === 'en-US' ? 'Create playlist' : '创建歌单'"
      :title="locale === 'en-US' ? 'Create playlist' : '创建歌单'"
      @click="emit('createPlaylist')"
    >
      <Plus :size="17" />
    </button>
  </span>
</template>

<style scoped>
.nav-section-break {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
  width: var(--sidebar-nav-item-width, 100%);
  height: 34px;
  margin: 5px 0 6px 8px;
  transition:
    width 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    margin 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    grid-template-columns 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nav-divider {
  display: block;
  height: 1px;
  background: var(--smw-border);
}

.nav-add-button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.nav-add-button:hover {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.nav-section-break.is-collapsed {
  margin: 5px 0 6px;
  grid-template-columns: 58px;
}

.nav-section-break.is-collapsed .nav-divider {
  display: none;
}

.nav-section-break.is-collapsed .nav-add-button {
  width: 58px;
  height: 34px;
  margin: 0;
}
</style>
