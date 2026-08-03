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
      v-if="!collapsed"
      :label="t(locale, 'collapseSidebar')"
      @collapse="emit('toggleCollapsed')"
    />
  </div>
</template>

<style scoped>
.brand {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 0;
  font-size: 17px;
}

.brand :deep(.brand-mark) {
  justify-self: center;
}

.brand.is-collapsed {
  grid-template-columns: 58px;
  justify-content: center;
  gap: 8px;
  width: 58px;
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

.brand > .sidebar-text {
  max-width: none;
}

.brand.is-collapsed .sidebar-text {
  display: none;
}
</style>
