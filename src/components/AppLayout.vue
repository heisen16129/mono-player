<script setup lang="ts">
import AppLayoutResizeHandle from './AppLayoutResizeHandle.vue';
import type { StyleValue } from 'vue';
import type { AppLayoutVariant } from '../composables/useAppLayoutVariant';

withDefaults(defineProps<{
  resizingPanel: boolean;
  showResizeHandle: boolean;
  style?: StyleValue;
  variant?: AppLayoutVariant;
  visible: boolean;
}>(), {
  style: undefined,
  variant: 'default',
});

defineEmits<{
  startLibraryPanelResize: [event: PointerEvent];
}>();
</script>

<template>
  <div
    v-if="visible"
    class="app-layout"
    :class="[
      `is-${variant}`,
      {
        'is-resizing-library-panel': resizingPanel,
      },
    ]"
    :style="style"
  >
    <slot></slot>

    <AppLayoutResizeHandle
      v-if="showResizeHandle"
      :resizing="resizingPanel"
      @start-resize="$emit('startLibraryPanelResize', $event)"
    />
  </div>
</template>

<style scoped>
.app-layout {
  position: relative;
  z-index: 1;
  grid-row: 1;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-layout.is-resizing-library-panel {
  transition: none;
}

:global(body.is-resizing-library-panel) {
  cursor: col-resize;
  user-select: none;
}

@media (max-width: 820px) {
  .app-layout {
    overflow: auto;
  }
}
</style>
