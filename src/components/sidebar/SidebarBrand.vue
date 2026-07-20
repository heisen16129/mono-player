<script setup lang="ts">
import { t } from '../../i18n';
import type { Locale } from '../../types/music';

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
    <button
      class="brand-mark brand-mark-button"
      type="button"
      aria-label="Mono Player"
      title="Mono Player"
      @click="collapsed && emit('toggleCollapsed')"
    >
      <span class="brand-letter">M</span>
      <svg class="brand-expand-glyph" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
        <path d="M10.75 4.75v10.5" />
      </svg>
    </button>
    <strong class="sidebar-text">Mono Player</strong>
    <button
      v-if="!collapsed"
      class="icon-button collapse-button"
      type="button"
      :aria-label="t(locale, 'collapseSidebar')"
      :title="t(locale, 'collapseSidebar')"
      @click="emit('toggleCollapsed')"
    >
      <svg class="collapse-glyph" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
        <path d="M9.25 4.75v10.5" />
      </svg>
    </button>
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
  transition:
    gap 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand.is-collapsed {
  grid-template-columns: 38px;
  justify-content: start;
  gap: 10px;
  padding: 0 0 0 14px;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--smw-border-strong);
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}

.brand-letter,
.brand-expand-glyph {
  grid-area: 1 / 1;
  transition:
    opacity 120ms ease,
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand-expand-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  opacity: 0;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
  transform: scale(0.86);
}

.brand-mark-button {
  padding: 0;
  border: 0;
  appearance: none;
  cursor: default;
}

.brand.is-collapsed .brand-mark-button {
  cursor: pointer;
}

.brand.is-collapsed .brand-mark-button:hover .brand-letter,
.brand.is-collapsed .brand-mark-button:focus-visible .brand-letter {
  opacity: 0;
  transform: scale(0.86);
}

.brand.is-collapsed .brand-mark-button:hover .brand-expand-glyph,
.brand.is-collapsed .brand-mark-button:focus-visible .brand-expand-glyph {
  opacity: 1;
  transform: scale(1);
}

.collapse-button {
  width: 34px;
  height: 38px;
  color: var(--smw-icon-muted);
}

.collapse-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
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
