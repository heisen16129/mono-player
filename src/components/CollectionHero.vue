<script setup lang="ts">
import type { Track } from '../types/music';
import CollectionHeroActions from './CollectionHeroActions.vue';
import CollectionHeroText from './CollectionHeroText.vue';
import FolderCover from './FolderCover.vue';

const props = defineProps<{
  canLocate: boolean;
  canPlay: boolean;
  canChangeCover?: boolean;
  coverUrl?: string | null;
  date: string;
  locateLabel: string;
  playLabel: string;
  subtitle: string;
  title: string;
  tracks: Track[];
}>();

const emit = defineEmits<{
  changeCover: [];
  locate: [];
  play: [];
}>();

function handleCoverContextMenu() {
  if (!props.canChangeCover) return;
  emit('changeCover');
}
</script>

<template>
  <section class="collection-hero">
    <FolderCover class="collection-hero-cover" :cover-url="coverUrl" :tracks="tracks" tone="night" @contextmenu.prevent="handleCoverContextMenu" />
    <div class="collection-hero-copy">
      <CollectionHeroText :date="date" :subtitle="subtitle" :title="title" />
      <CollectionHeroActions
        :can-locate="canLocate"
        :can-play="canPlay"
        :locate-label="locateLabel"
        :play-label="playLabel"
        @locate="emit('locate')"
        @play="emit('play')"
      />
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

.collection-hero-cover.folder-cover:not(.has-cover-image) {
  transform: translateY(6px);
}

.collection-hero-copy {
  display: grid;
  align-content: center;
  justify-items: start;
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
}

@media (max-width: 820px) {
  .collection-hero {
    grid-template-columns: 1fr;
  }
}
</style>
