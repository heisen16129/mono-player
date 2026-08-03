<script setup lang="ts">
import PluginManagerView from './PluginManagerView.vue';
import SettingsView from './SettingsView.vue';
import ThemeView from './ThemeView.vue';
import type { AppUtilityPageOutletEmits, AppUtilityPageOutletProps, PluginManagerViewListeners } from '../types/appPageOutlet';

defineProps<AppUtilityPageOutletProps>();

const emit = defineEmits<AppUtilityPageOutletEmits>();

const pluginManagerViewListeners: PluginManagerViewListeners = {
  onNotify: (...args) => emit('notify', ...args),
};
</script>

<template>
  <div class="utility-page-outlet">
    <ThemeView v-if="activeView === 'themes'" />
    <PluginManagerView v-else-if="activeView === 'plugins'" v-bind="pluginManagerViewListeners" />
    <SettingsView v-else-if="activeView === 'settings'" />
  </div>
</template>

<style scoped>
.utility-page-outlet {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>

