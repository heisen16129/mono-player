<script setup lang="ts">
import AppArtistsPageOutlet from './AppArtistsPageOutlet.vue';
import AppDiscoverPageOutlet from './AppDiscoverPageOutlet.vue';
import AppDownloadsPageOutlet from './AppDownloadsPageOutlet.vue';
import AppLibraryHomePageOutlet from './AppLibraryHomePageOutlet.vue';
import AppUtilityPageOutlet from './AppUtilityPageOutlet.vue';
import AppWorkspacePageOutlet from './AppWorkspacePageOutlet.vue';
import { useAppPageOutletBindings } from '../composables/useAppPageOutletBindings';
import { isLibraryHomeOutlet, isUtilityOutlet, isWorkspaceOutlet } from '../composables/useAppPageOutletMode';
import type { AppPageOutletEmits, AppPageOutletProps } from '../types/appPageOutlet';

const props = defineProps<AppPageOutletProps>();

const emit = defineEmits<AppPageOutletEmits>();

const {
  artistsPageOutletListeners,
  artistsPageOutletProps,
  discoverPageOutletListeners,
  discoverPageOutletProps,
  downloadsPageOutletListeners,
  downloadsPageOutletProps,
  libraryHomePageOutletListeners,
  libraryHomePageOutletProps,
  utilityPageOutletListeners,
  utilityPageOutletProps,
  workspacePageOutletListeners,
  workspacePageOutletProps,
} = useAppPageOutletBindings(props, emit);
</script>

<template>
  <div class="app-page-outlet">
    <AppLibraryHomePageOutlet
      v-if="isLibraryHomeOutlet(activeView, activeCollection, isLibraryPanelMode)"
      v-bind="{ ...libraryHomePageOutletProps, ...libraryHomePageOutletListeners }"
    />

    <AppDiscoverPageOutlet
      v-else-if="activeView === 'discover'"
      v-bind="{ ...discoverPageOutletProps, ...discoverPageOutletListeners }"
    />

    <AppWorkspacePageOutlet
      v-else-if="isWorkspaceOutlet(activeView, activeCollection, isLibraryPanelMode)"
      v-bind="{ ...workspacePageOutletProps, ...workspacePageOutletListeners }"
    />

    <AppArtistsPageOutlet
      v-else-if="activeView === 'artists'"
      v-bind="{ ...artistsPageOutletProps, ...artistsPageOutletListeners }"
    />

    <AppDownloadsPageOutlet
      v-else-if="activeView === 'downloads'"
      v-bind="{ ...downloadsPageOutletProps, ...downloadsPageOutletListeners }"
    />

    <AppUtilityPageOutlet
      v-else-if="isUtilityOutlet(activeView)"
      v-bind="{ ...utilityPageOutletProps, ...utilityPageOutletListeners }"
    />
  </div>
</template>

<style scoped>
.app-page-outlet {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>

