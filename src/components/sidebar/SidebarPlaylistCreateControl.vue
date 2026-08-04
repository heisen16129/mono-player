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
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
  width: var(--sidebar-nav-item-width, 100%);
  height: 34px;
  margin: 5px 0 6px 8px;
  transition: none;
}

.nav-divider {
  display: block;
  position: absolute;
  top: 50%;
  left: 0;
  width: calc(100% - 38px);
  height: 1px;
  background: var(--smw-border);
  transform: translateY(-50%) scaleX(1);
  transform-origin: left center;
  transition: transform var(--sidebar-motion-duration, 340ms) var(--sidebar-motion-easing, cubic-bezier(0.22, 0.76, 0.22, 1));
}

.nav-add-button {
  z-index: 1;
  position: absolute;
  top: 50%;
  left: calc(100% - 30px);
  display: grid;
  width: 30px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--smw-icon-muted);
  background: var(--smw-bg-sidebar);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    left var(--sidebar-motion-duration, 340ms) var(--sidebar-motion-easing, cubic-bezier(0.22, 0.76, 0.22, 1)),
    width var(--sidebar-motion-duration, 340ms) var(--sidebar-motion-easing, cubic-bezier(0.22, 0.76, 0.22, 1)),
    color 160ms ease,
    background-color 160ms ease;
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
  width: 58px;
  transform: translateY(-50%) scaleX(0);
}

.nav-section-break.is-collapsed .nav-add-button {
  left: 0;
  width: 58px;
  margin: 0;
}
</style>
