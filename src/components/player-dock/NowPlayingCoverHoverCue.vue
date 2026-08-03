<script setup lang="ts">
import { ChevronsUp } from '@lucide/vue';
</script>

<template>
  <span class="cover-hover-cue" aria-hidden="true">
    <ChevronsUp :size="24" />
  </span>
</template>

<style scoped>
:global(.cover-hover-cue) {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(31, 32, 40, 0.62);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 150ms ease, transform 150ms ease;
}
</style>
