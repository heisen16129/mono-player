<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';
import SidebarBrandCollapseButton from './SidebarBrandCollapseButton.vue';
import SidebarBrandMark from './SidebarBrandMark.vue';

defineProps<{
  collapsed: boolean;
  locale: Locale;
}>();

const emit = defineEmits<{
  toggleCollapsed: [];
}>();
</script>

<template>
  <div class="brand" :class="{ 'is-collapsed': collapsed }">
    <SidebarBrandMark :collapsed="collapsed" @expand="emit('toggleCollapsed')" />
    <strong class="sidebar-text">Mono Player</strong>
    <SidebarBrandCollapseButton
      class="brand-collapse-button"
      :class="{ 'is-hidden': collapsed }"
      :label="t(locale, 'collapseSidebar')"
      @collapse="emit('toggleCollapsed')"
    />
  </div>
</template>

<style scoped>
.brand {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: var(--sidebar-nav-item-width, 100%);
  overflow: hidden;
  padding: 0;
  font-size: 17px;
  transition:
    grid-template-columns 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand :deep(.brand-mark) {
  justify-self: center;
}

.brand.is-collapsed {
  align-self: flex-start;
  grid-template-columns: 58px minmax(0, 0fr) 0;
  justify-content: start;
  gap: 0;
  padding: 0;
}

.sidebar-text {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  opacity: 1;
  white-space: nowrap;
  transform: translateX(0);
  transition:
    max-width 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand.is-collapsed .sidebar-text {
  max-width: 0;
  opacity: 0;
  transform: translateX(-6px);
}

.brand-collapse-button {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 120ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand-collapse-button.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px);
}
</style>
