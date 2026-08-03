<script setup lang="ts">
import type { AppTheme, CustomTheme } from '../../types/music';
import ThemeCardCheck from './ThemeCardCheck.vue';
import ThemeCardCover from './ThemeCardCover.vue';
import ThemeCardPreviewImage from './ThemeCardPreviewImage.vue';
import ThemeCardText from './ThemeCardText.vue';
import ThemeCustomDeleteButton from './ThemeCustomDeleteButton.vue';

const props = defineProps<{
  authorLabel: string;
  customPreviewSrc: (theme: CustomTheme) => string;
  customPreviewStyle: (variables: Record<string, string>) => Record<string, string>;
  deleteThemeText: string;
  selectedTheme: AppTheme;
  theme: CustomTheme;
}>();

const emit = defineEmits<{
  removeCustomTheme: [themeId: `custom:${string}`];
  selectTheme: [theme: AppTheme];
}>();
</script>

<template>
  <article
    class="theme-card"
    :class="{ selected: selectedTheme === theme.id }"
    role="button"
    tabindex="0"
    @click.stop="emit('selectTheme', theme.id)"
    @keydown.enter.stop.prevent="emit('selectTheme', theme.id)"
    @keydown.space.stop.prevent="emit('selectTheme', theme.id)"
  >
    <span class="theme-card-preview custom-theme-preview" :style="customPreviewStyle(theme.variables)">
      <ThemeCardPreviewImage
        v-if="customPreviewSrc(theme)"
        :src="customPreviewSrc(theme)"
      />
      <ThemeCardCover v-else />
      <ThemeCustomDeleteButton :label="deleteThemeText" @remove="emit('removeCustomTheme', theme.id)" />
      <ThemeCardCheck v-if="selectedTheme === props.theme.id" />
    </span>
    <ThemeCardText :author="theme.author" :author-label="authorLabel" :title="theme.name" />
  </article>
</template>

<style scoped>
.theme-card {
  display: grid;
  gap: 7px;
  width: 150px;
  padding: 0;
  border: 0;
  color: var(--smw-text-primary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.theme-card:focus {
  outline: none;
}

.theme-card-preview {
  --theme-delete-opacity: 0;
  --theme-delete-pointer-events: none;
  position: relative;
  display: grid;
  place-items: center;
  width: 150px;
  height: 100px;
  overflow: hidden;
  border: 1px solid var(--smw-border-soft);
  border-radius: 6px;
  color: var(--smw-text-secondary);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.theme-card:hover .theme-card-preview {
  --theme-delete-opacity: 1;
  --theme-delete-pointer-events: auto;
  transform: translateY(-1px);
  border-color: var(--smw-text-secondary);
}

.theme-card:focus-within .theme-card-preview {
  --theme-delete-opacity: 1;
  --theme-delete-pointer-events: auto;
}

.theme-card.selected .theme-card-preview,
.theme-card:focus-visible .theme-card-preview {
  border-color: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 18%, transparent);
}

.custom-theme-preview {
  color: transparent;
  background: var(--cover-page, var(--smw-bg-panel));
}

</style>
