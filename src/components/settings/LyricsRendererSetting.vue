<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLyricsRendererSettings } from '../../composables/useLyricsRendererSettings';
import { usePlayerStore } from '../../stores/player';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const {
  activeRendererId,
  hydrateLyricsRendererSettings,
  rendererPlugins,
  selectLyricsRenderer,
} = useLyricsRendererSettings();

function selectRenderer(event: Event) {
  selectLyricsRenderer((event.target as HTMLSelectElement).value);
}

onMounted(() => {
  void hydrateLyricsRendererSettings();
});
</script>

<template>
  <div class="renderer-setting">
    <p>{{ locale === 'en-US' ? 'Lyrics page' : '歌词页面' }}</p>
    <label class="field-row">
      <span>{{ locale === 'en-US' ? 'Renderer' : '页面样式' }}</span>
      <select v-model="activeRendererId" @change="selectRenderer">
        <option v-for="plugin in rendererPlugins" :key="plugin.id" :value="plugin.id">
          {{ locale === 'en-US' ? (plugin.nameEn ?? plugin.name) : plugin.name }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.renderer-setting {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}

.renderer-setting > p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
  font-weight: 650;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 320px);
  gap: 10px;
  align-items: center;
  max-width: 560px;
  color: var(--smw-text-body);
  font-size: 13px;
}

.field-row select {
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

.field-row select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

@media (max-width: 720px) {
  .field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
