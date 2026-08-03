<script setup lang="ts">
import { Download, Heart } from '@lucide/vue';

defineProps<{
  enableDownloadAction?: boolean;
  hideActionHeader?: boolean;
  showFavoriteAction?: boolean;
}>();
</script>

<template>
  <span class="track-actions-head">
    <template v-if="!hideActionHeader">
      <Heart v-if="showFavoriteAction !== false" :size="17" />
      <Download v-if="enableDownloadAction" :size="17" />
    </template>
  </span>
</template>

<style scoped>
.track-actions-head {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
