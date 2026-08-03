<script setup lang="ts">
import PlayerDock from './PlayerDock.vue';
import type { PlayerDockListeners, PlayerDockProps } from '../types/playerDock';

defineProps<{
  hidden: boolean;
  listeners: PlayerDockListeners;
  props: PlayerDockProps;
}>();
</script>

<template>
  <PlayerDock
    :class="{ 'lyrics-auto-hidden': hidden }"
    v-bind="{ ...props, ...listeners }"
  />
</template>
