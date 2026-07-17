<script setup lang="ts">
import { LocateFixed, Play } from '@lucide/vue';
import type { Track } from '../types/music';
import FolderCover from './FolderCover.vue';

defineProps<{
  canLocate: boolean;
  canPlay: boolean;
  date: string;
  locateLabel: string;
  playLabel: string;
  subtitle: string;
  title: string;
  tracks: Track[];
}>();

const emit = defineEmits<{
  locate: [];
  play: [];
}>();
</script>

<template>
  <section class="collection-hero">
    <FolderCover class="collection-hero-cover" :tracks="tracks" tone="night" />
    <div class="collection-hero-copy">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
      <small>{{ date }}</small>
      <div class="collection-hero-actions">
        <button
          class="collection-play-button"
          type="button"
          :disabled="!canPlay"
          @click="emit('play')"
        >
          <Play :size="16" fill="currentColor" />{{ playLabel }}
        </button>
        <button
          class="collection-locate-button"
          type="button"
          :disabled="!canLocate"
          :aria-label="locateLabel"
          @click="emit('locate')"
        >
          <LocateFixed :size="17" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.collection-hero {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 40px;
  align-items: center;
  padding: 28px 24px 18px;
}

.collection-hero-cover.folder-cover {
  width: 220px;
  aspect-ratio: 1;
  border-radius: 7px;
}

.collection-hero-copy {
  display: grid;
  align-content: center;
  justify-items: start;
}

.collection-hero-copy h2 {
  margin: 0 0 2px;
  color: var(--smw-text-primary);
  font-size: 34px;
  font-weight: 720;
  line-height: 1.16;
}

.collection-hero-copy p {
  margin: 0 0 18px;
  color: var(--smw-text-body);
  font-size: 21px;
  font-weight: 560;
}

.collection-hero-copy small {
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.collection-hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.collection-play-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border: 1px solid var(--smw-button-primary);
  border-radius: 6px;
  color: #fff;
  background: var(--smw-button-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 620;
}

.collection-play-button:hover:not(:disabled) {
  filter: brightness(0.96);
}

.collection-play-button:disabled {
  cursor: default;
  opacity: 0.48;
}

.collection-locate-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  color: var(--smw-icon-muted);
  background: transparent;
  cursor: pointer;
}

.collection-locate-button:hover {
  color: var(--smw-text-primary);
}

.collection-locate-button svg {
  color: currentColor;
  stroke: currentColor;
}

.collection-locate-button:disabled {
  cursor: default;
  color: var(--smw-icon-muted);
  opacity: 1;
}

@media (max-width: 1100px) {
  .collection-hero {
    grid-template-columns: 170px minmax(0, 1fr);
    gap: 26px;
  }

  .collection-hero-cover.folder-cover {
    width: 170px;
  }
}

@media (max-height: 760px) and (min-width: 821px) {
  .collection-hero {
    grid-template-columns: 150px minmax(0, 1fr);
    gap: 26px;
    padding: 18px 24px 12px;
  }

  .collection-hero-cover.folder-cover {
    width: 150px;
  }

  .collection-hero-copy h2 {
    font-size: 28px;
  }

  .collection-hero-copy p {
    margin-bottom: 12px;
    font-size: 18px;
  }

  .collection-hero-actions {
    margin-top: 18px;
  }

  .collection-play-button {
    height: 38px;
    padding: 0 15px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .collection-hero {
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 22px;
    padding: 12px 24px 8px;
  }

  .collection-hero-cover.folder-cover {
    width: 120px;
  }

  .collection-hero-copy h2 {
    font-size: 24px;
  }

  .collection-hero-copy p {
    margin-bottom: 8px;
    font-size: 15px;
  }

  .collection-hero-copy small {
    font-size: 12px;
  }

  .collection-hero-actions {
    margin-top: 12px;
  }

  .collection-play-button {
    height: 34px;
    padding: 0 13px;
    font-size: 13px;
  }

  .collection-locate-button {
    width: 32px;
    height: 32px;
  }
}

@media (max-width: 820px) {
  .collection-hero {
    grid-template-columns: 1fr;
  }
}
</style>
