<script setup lang="ts">
defineProps<{
  hasThemeBackground: boolean;
  lyricsOpen: boolean;
  lyricsTransitioning: boolean;
  sidebarCollapsed: boolean;
}>();

defineEmits<{
  closeContextMenus: [];
  startWindowDrag: [event: PointerEvent];
}>();
</script>

<template>
  <main
    class="mono-window"
    :class="{
      'sidebar-collapsed': sidebarCollapsed,
      'lyrics-open': lyricsOpen || lyricsTransitioning,
      'has-theme-background': hasThemeBackground,
    }"
    @click="$emit('closeContextMenus')"
    @contextmenu="$emit('closeContextMenus')"
    @pointerdown="$emit('startWindowDrag', $event)"
  >
    <slot name="overlays"></slot>

    <aside class="app-shell-menu">
      <slot name="menu"></slot>
    </aside>

    <section class="app-shell-content">
      <slot name="content"></slot>
    </section>

    <section class="app-shell-dock">
      <slot name="dock"></slot>
    </section>
  </main>
</template>

<style scoped>
.mono-window {
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.mono-window.sidebar-collapsed {
  grid-template-columns: var(--sidebar-collapsed-width) minmax(0, 1fr);
}

.app-shell-menu {
  position: relative;
  z-index: 1;
  grid-row: 1;
  grid-column: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-shell-content {
  position: relative;
  z-index: 1;
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-shell-dock {
  position: relative;
  z-index: 30;
  grid-row: 2;
  grid-column: 1 / -1;
  min-width: 0;
}

:slotted(.app-startup-loading) {
  grid-row: 1 / 3;
  grid-column: 1 / -1;
}

@media (max-width: 820px) {
  .mono-window,
  .mono-window.sidebar-collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .app-shell-menu,
  .app-shell-content,
  .app-shell-dock {
    grid-column: 1;
  }

  .app-shell-menu {
    grid-row: 1;
  }

  .app-shell-content {
    grid-row: 2;
  }

  .app-shell-dock {
    grid-row: 3;
  }
}
</style>
