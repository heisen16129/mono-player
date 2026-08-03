<script setup lang="ts">
import { LocateFixed } from '@lucide/vue';
import { songCount, t } from '../../i18n';
import type { Locale, Track } from '../../types/music';

const props = defineProps<{
  activeTrack: Track | null;
  locale: Locale;
  queueTracks: readonly Track[];
}>();

const emit = defineEmits<{
  locate: [];
}>();
</script>

<template>
  <header class="queue-popover-head">
    <div class="queue-title-actions">
      <strong>{{ t(locale, 'playbackQueue') }}</strong>
      <button
        class="queue-locate-button"
        type="button"
        :disabled="!activeTrack || !props.queueTracks.some((track) => track.id === activeTrack?.id)"
        :aria-label="t(locale, 'locateCurrentTrack')"
        :title="t(locale, 'locateCurrentTrack')"
        @click="emit('locate')"
      >
        <LocateFixed :size="15" />
      </button>
    </div>
    <span>{{ songCount(locale, queueTracks.length) }}</span>
  </header>
</template>

<style scoped>
.queue-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 50px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--smw-border-soft);
}

.queue-popover-head strong {
  color: var(--smw-text-primary);
  font-size: 15px;
}

.queue-title-actions {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.queue-locate-button {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.queue-locate-button:hover {
  color: var(--smw-text-primary);
}

.queue-locate-button:disabled {
  cursor: default;
  color: var(--smw-icon-muted);
  opacity: 0.42;
}

.queue-popover-head span {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
