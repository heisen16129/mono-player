<script setup lang="ts">
import BaseDialog from '../BaseDialog.vue';
import PluginPageOutlet from './PluginPageOutlet.vue';
import { usePluginNavigation } from '../../composables/usePluginNavigation';
const { dialogPlugin, dialogPage, closeDialog } = usePluginNavigation();
</script>

<template>
  <Teleport to="body">
    <BaseDialog v-if="dialogPlugin && dialogPage" :label="dialogPage.title" :title="dialogPage.title"
      close-label="关闭" close-on-overlay width="min(1080px, calc(100vw - 48px))"
      max-height="calc(100vh - var(--player-height) - 48px)" overflow="hidden" overlay-background="#0005" :z-index="1200"
      @close="closeDialog" @keydown.esc="closeDialog">
      <div class="plugin-dialog-content">
        <PluginPageOutlet :plugin="dialogPlugin" :page="dialogPage" embedded />
      </div>
    </BaseDialog>
  </Teleport>
</template>

<style scoped>
.plugin-dialog-content { height: min(740px, calc(100vh - var(--player-height) - 144px)); min-height: 0; }
</style>
