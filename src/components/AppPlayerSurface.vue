<script setup lang="ts">
import { ref } from 'vue';
import PlayerDock from './PlayerDock.vue';
import type { PlayerDockListeners, PlayerDockProps } from '../types/playerDock';
import type { PlayerDockController } from '../types/playerDockController';

const dockRef = ref<{ getController: () => PlayerDockController } | null>(null);

defineProps<{
  hidden: boolean;
  listeners: PlayerDockListeners;
  props: PlayerDockProps;
}>();

defineExpose({ getController: () => dockRef.value?.getController() ?? null });
</script>

<template>
  <PlayerDock
    ref="dockRef"
    :class="{ 'lyrics-auto-hidden': hidden }"
    v-bind="{ ...props, ...listeners }"
  />
</template>
