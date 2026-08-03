<script setup lang="ts">
import AppLayout from './AppLayout.vue';
import AppPageOutlet from './AppPageOutlet.vue';
import { resolveAppLayoutVariant } from '../composables/useAppLayoutVariant';
import { useAppMainContentOutletBindings } from '../composables/useAppMainContentOutletBindings';
import type { AppMainContentEmits, AppMainContentProps } from '../types/appMainContent';

const props = defineProps<AppMainContentProps>();

const emit = defineEmits<AppMainContentEmits>();

const {
  pageOutletListeners,
  pageOutletProps,
} = useAppMainContentOutletBindings(props, emit);
</script>

<template>
  <AppLayout
    :visible="isLibraryVisible"
    :resizing-panel="isResizingLibraryPanel"
    :show-resize-handle="shouldShowLibraryResizeHandle"
    :style="appGridStyle"
    :variant="resolveAppLayoutVariant(activeView, activePlaylistId, activeCollection, isLibraryPanelMode, activeLibraryFilter)"
    @start-library-panel-resize="$emit('startLibraryPanelResize', $event)"
  >
    <AppPageOutlet
      v-bind="{ ...pageOutletProps, ...pageOutletListeners }"
    />
  </AppLayout>
</template>
