<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ChevronDown } from '@lucide/vue';
import SettingsOptionSelect from './SettingsOptionSelect.vue';
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

const options = computed(() => rendererPlugins.value.map(plugin => ({
  id: plugin.id,
  name: locale.value === 'en-US' ? (plugin.nameEn ?? plugin.name) : plugin.name,
})));
const selectedName = computed(() => options.value.find(option => option.id === activeRendererId.value)?.name ?? '');

onMounted(() => {
  void hydrateLyricsRendererSettings();
});
</script>

<template>
  <details class="renderer-setting" open>
    <summary>{{ locale === 'en-US' ? 'Lyrics page' : '歌词页面' }}</summary>
    <div class="field-row">
      <span>{{ locale === 'en-US' ? 'Renderer' : '页面样式' }}</span>
      <SettingsOptionSelect :options="options" :locale="locale" :value="activeRendererId" :label="locale === 'en-US' ? 'Renderer' : '页面样式'" @change="selectLyricsRenderer">
        <span class="renderer-choice"><span>{{ selectedName }}</span><ChevronDown :size="14" aria-hidden="true" /></span>
      </SettingsOptionSelect>
    </div>
  </details>
</template>

<style scoped>
.renderer-setting {
  min-width: 0;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
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

.renderer-choice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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

.field-row :deep(.device-trigger:focus-visible) .renderer-choice {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

@media (max-width: 720px) {
  .field-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
