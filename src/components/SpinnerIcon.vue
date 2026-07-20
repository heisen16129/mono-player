<script setup lang="ts">
import { Loader2 } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 16,
});
</script>

<template>
  <Loader2 class="spinner-icon" :size="size" />
</template>

<style scoped>
.spinner-icon {
  animation: spinnerIconSpin 760ms linear infinite;
}

@keyframes spinnerIconSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
