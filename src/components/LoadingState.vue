<script setup lang="ts">
import SpinnerIcon from './SpinnerIcon.vue';

withDefaults(defineProps<{
  iconSize?: number;
  message: string;
}>(), {
  iconSize: 18,
});
</script>

<template>
  <p class="loading-state-view">
    <SpinnerIcon :size="iconSize" />
    {{ message }}
  </p>
</template>

<style scoped>
.loading-state-view {
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 220px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 14px;
  text-align: center;
}

</style>
