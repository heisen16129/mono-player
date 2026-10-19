<script setup lang="ts">
import { ref } from 'vue';
import StemSeparationDialog from './StemSeparationDialog.vue';
defineProps<{ pluginId: string; disabled?: boolean }>();
const visible = ref(false);
</script>
<template>
  <slot :open="() => { visible = true; }">
    <button class="separation-launcher" type="button" :disabled="disabled" @pointerdown.stop @click.stop="visible = true">分离</button>
  </slot>
  <Teleport to="body"><StemSeparationDialog v-if="visible" :plugin-id="pluginId" @close="visible = false" /></Teleport>
</template>
<style scoped>
.separation-launcher { border: 0; padding: 0; background: transparent; color: var(--smw-text-body); font: inherit; cursor: pointer; }
.separation-launcher:hover { text-decoration: underline; text-underline-offset: 3px; }
.separation-launcher:disabled { opacity: 0.45; cursor: default; }
</style>
