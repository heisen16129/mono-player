<script setup lang="ts">
import TrackMetadataField from './TrackMetadataField.vue';

defineProps<{
  album: string;
  artist: string;
  genre: string;
  title: string;
  trackNumber: string;
  year: string;
}>();

const emit = defineEmits<{
  updateAlbum: [value: string];
  updateArtist: [value: string];
  updateGenre: [value: string];
  updateTitle: [value: string];
  updateTrackNumber: [value: string];
  updateYear: [value: string];
}>();
</script>

<template>
  <section class="metadata-editor" aria-label="歌曲信息">
    <TrackMetadataField label="名称" :value="title" placeholder="请输入歌曲名称" required @update="emit('updateTitle', $event)" />
    <TrackMetadataField label="专辑" :value="album" placeholder="请输入专辑" @update="emit('updateAlbum', $event)" />
    <TrackMetadataField label="艺术家" :value="artist" placeholder="请输入艺术家" @update="emit('updateArtist', $event)" />
    <TrackMetadataField label="年份" :value="year" type="number" inputmode="numeric" min="1000" max="9999" placeholder="例如 2024" @update="emit('updateYear', $event)" />
    <TrackMetadataField label="歌曲序号" :value="trackNumber" type="number" inputmode="numeric" min="1" placeholder="例如 1" @update="emit('updateTrackNumber', $event)" />
    <TrackMetadataField label="风格" :value="genre" placeholder="请输入风格" @update="emit('updateGenre', $event)" />
  </section>
</template>

<style scoped>
.metadata-editor {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

</style>
