<script setup lang="ts">
import { CheckCircle2, Download } from '@lucide/vue';
import SpinnerIcon from './SpinnerIcon.vue';

defineProps<{
  canDownload: boolean;
  isDownloaded: boolean;
  isPendingDownload: boolean;
  label: string;
}>();

const emit = defineEmits<{
  download: [];
}>();
</script>

<template>
  <button
    class="download-icon"
    :class="{ 'is-downloaded': isDownloaded, 'is-downloading': isPendingDownload }"
    type="button"
    :aria-label="label"
    :disabled="!canDownload"
    :title="label"
    @click.stop="canDownload && emit('download')"
  >
    <CheckCircle2 v-if="isDownloaded" :size="17" />
    <SpinnerIcon v-else-if="isPendingDownload" :size="17" />
    <Download v-else :size="17" />
  </button>
</template>

<style scoped>
.download-icon {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, transform 140ms ease;
}

.download-icon:hover {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 10%, transparent);
  border-radius: 999px;
}

.download-icon:active {
  transform: scale(0.94);
}

.download-icon:focus-visible {
  border-radius: 999px;
  outline: 2px solid var(--smw-text-primary);
  outline-offset: 3px;
}

.download-icon.is-downloaded {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.9;
}

.download-icon.is-downloaded:hover {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.download-icon.is-downloading {
  color: var(--smw-button-primary);
  cursor: default;
  opacity: 0.92;
}

.download-icon.is-downloading:hover {
  background: color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.download-icon.is-downloading svg {
  animation: spin 760ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
