<script setup lang="ts">
import { Check } from '@lucide/vue';
</script>

<template>
  <Check class="theme-card-check" :size="18" />
</template>

<style scoped>
.theme-card-check {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 50%;
  color: #ffffff;
  background: var(--smw-button-primary);
}
</style>
