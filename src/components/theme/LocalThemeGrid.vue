<script setup lang="ts">
import { t } from '../../i18n';
import ThemeBuiltInCard from './ThemeBuiltInCard.vue';
import ThemeCustomCard from './ThemeCustomCard.vue';
import type { LocalThemeGridEmits, LocalThemeGridProps } from './types';

defineProps<LocalThemeGridProps>();

const emit = defineEmits<LocalThemeGridEmits>();
</script>

<template>
  <div class="theme-grid-list">
    <ThemeBuiltInCard
      v-for="theme in localThemeCards"
      :key="theme.value"
      :author-label="t(locale, 'author')"
      :selected-theme="selectedTheme"
      :theme="theme"
      @select-theme="emit('selectTheme', $event)"
    />

    <ThemeCustomCard
      v-for="theme in customThemeCards"
      :key="theme.id"
      :author-label="t(locale, 'author')"
      :custom-preview-src="customPreviewSrc"
      :custom-preview-style="customPreviewStyle"
      :delete-theme-text="deleteThemeText"
      :selected-theme="selectedTheme"
      :theme="theme"
      @remove-custom-theme="emit('removeCustomTheme', $event)"
      @select-theme="emit('selectTheme', $event)"
    />
  </div>
</template>

<style scoped>
.theme-grid-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 28px 38px;
  align-items: start;
  padding-top: 24px;
}

</style>
