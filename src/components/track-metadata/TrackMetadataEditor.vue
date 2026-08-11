<script setup lang="ts">
import { computed } from 'vue';
import { splitArtistText } from '../../utils/artist';
import TrackMetadataField from './TrackMetadataField.vue';

const props = defineProps<{
  album: string;
  artist: string;
  genre: string;
  title: string;
  trackNumber: string;
  year: string;
}>();

const artistTokens = computed(() => splitArtistText(props.artist));

function updateArtistTokens(tokens: string[]) {
  emit('updateArtist', tokens.join(' & '));
}

function addArtist(value: string) {
  const next = value.trim();
  if (!next) return;
  updateArtistTokens([...artistTokens.value, next]);
}

function removeArtist(index: number) {
  updateArtistTokens(artistTokens.value.filter((_, tokenIndex) => tokenIndex !== index));
}

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
    <h3>基础标签</h3>
    <TrackMetadataField label="名称" :value="title" placeholder="请输入歌曲名称" required @update="emit('updateTitle', $event)" />
    <TrackMetadataField label="专辑" :value="album" placeholder="请输入专辑" @update="emit('updateAlbum', $event)" />
    <TrackMetadataField
      label="艺术家"
      :tokens="artistTokens"
      :value="artist"
      placeholder="请输入艺术家"
      variant="pill"
      @add-token="addArtist"
      @remove-token="removeArtist"
    />
    <TrackMetadataField label="年份" :value="year" type="number" inputmode="numeric" min="1000" max="9999" placeholder="例如 2024" @update="emit('updateYear', $event)" />
    <TrackMetadataField label="歌曲序号" :value="trackNumber" type="number" inputmode="numeric" min="1" placeholder="例如 1" @update="emit('updateTrackNumber', $event)" />
    <TrackMetadataField label="风格" :value="genre" placeholder="请输入风格" @update="emit('updateGenre', $event)" />
  </section>
</template>

<style scoped>
.metadata-editor {
  display: grid;
  align-content: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  background: var(--smw-bg-workspace);
}

.metadata-editor h3 {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
}

@media (max-width: 720px) {
  .metadata-editor {
    grid-template-columns: 1fr;
  }
}

</style>
