<script setup lang="ts">
import CollectionHeroLocateButton from './CollectionHeroLocateButton.vue';
import CollectionHeroPlayButton from './CollectionHeroPlayButton.vue';

defineProps<{
  canLocate: boolean;
  canPlay: boolean;
  locateLabel: string;
  playLabel: string;
}>();

const emit = defineEmits<{
  locate: [];
  play: [];
}>();
</script>

<template>
  <div class="collection-hero-actions">
    <CollectionHeroPlayButton :disabled="!canPlay" :label="playLabel" @play="emit('play')" />
    <CollectionHeroLocateButton :disabled="!canLocate" :label="locateLabel" @locate="emit('locate')" />
  </div>
</template>

<style scoped>
.collection-hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

@media (max-height: 760px) and (min-width: 821px) {
  .collection-hero-actions {
    margin-top: 18px;
  }
}

@media (max-height: 660px) and (min-width: 821px) {
  .collection-hero-actions {
    margin-top: 12px;
  }
}
</style>
