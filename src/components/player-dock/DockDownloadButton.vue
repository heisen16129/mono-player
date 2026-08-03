<script setup lang="ts">
import { CheckCircle2, Download } from '@lucide/vue';
import SpinnerIcon from '../SpinnerIcon.vue';

defineProps<{
  isDownloaded: boolean;
  isDownloading: boolean;
}>();

const emit = defineEmits<{
  download: [];
}>();
</script>

<template>
  <button
    class="icon-button dock-download-button"
    :class="{ 'is-downloaded': isDownloaded, 'is-downloading': isDownloading }"
    type="button"
    :disabled="isDownloaded || isDownloading"
    :aria-label="isDownloaded ? '已下载' : isDownloading ? '下载中' : '下载'"
    :title="isDownloaded ? '已下载' : isDownloading ? '下载中' : '下载'"
    @click="!isDownloaded && !isDownloading && emit('download')"
  >
    <CheckCircle2 v-if="isDownloaded" :size="18" />
    <SpinnerIcon v-else-if="isDownloading" :size="18" />
    <Download v-else :size="18" />
  </button>
</template>

<style scoped>
.dock-download-button {
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--smw-text-body);
}

.dock-download-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.dock-download-button.is-downloaded {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloaded:hover,
.dock-download-button.is-downloaded:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.dock-download-button.is-downloading:hover,
.dock-download-button.is-downloading:focus-visible {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.dock-download-button.is-downloading svg {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
