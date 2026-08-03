<script setup lang="ts">
import type { AppTheme } from '../../types/music';
import ThemeCardCheck from './ThemeCardCheck.vue';
import ThemeCardCover from './ThemeCardCover.vue';
import ThemeCardPreviewImage from './ThemeCardPreviewImage.vue';
import ThemeCardText from './ThemeCardText.vue';
import type { BuiltInThemeCard } from './types';

const props = defineProps<{
  authorLabel: string;
  selectedTheme: AppTheme;
  theme: BuiltInThemeCard;
}>();

const emit = defineEmits<{
  selectTheme: [theme: AppTheme];
}>();
</script>

<template>
  <button
    class="theme-card"
    :class="{ selected: selectedTheme === theme.value }"
    type="button"
    @click.stop="emit('selectTheme', theme.value)"
  >
    <span class="theme-card-preview" :class="theme.tone">
      <ThemeCardPreviewImage v-if="theme.previewUrl" :src="theme.previewUrl" />
      <ThemeCardCover v-else />
      <ThemeCardCheck v-if="selectedTheme === props.theme.value" />
    </span>
    <ThemeCardText :author="theme.author" :author-label="authorLabel" :title="theme.title" />
  </button>
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
  transform: translateY(-1px);
  border-color: var(--smw-text-secondary);
}

.theme-card.selected .theme-card-preview,
.theme-card:focus-visible .theme-card-preview {
  border-color: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 18%, transparent);
}

.theme-card-preview.blue-white {
  --cover-page: #fbfdff;
  --cover-sidebar: #f8fbff;
  --cover-border: #e2edf8;
  --cover-selected: #edf6ff;
  --cover-line: #4a90e2;
  --cover-line-soft: #dbe8f6;
  color: #4a90e2;
  background:
    linear-gradient(90deg, rgba(74, 144, 226, 0.12) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #ffffff 0%, #f5f5f7 58%, #eaf3ff 100%);
}

.theme-card-preview.wallpaper-tone.system-light {
  --system-preview-base: #fbfbfd;
  --system-preview-accent: #dfe4f2;
  --cover-page: color-mix(in srgb, var(--system-preview-base), black 0%);
  --cover-sidebar: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 34%);
  --cover-border: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 58%);
  --cover-selected: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 46%);
  --cover-line: #2f2f2f;
  --cover-line-soft: color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 58%);
  color: #2f2f2f;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--cover-border) 46%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, var(--cover-page), color-mix(in srgb, var(--system-preview-base), var(--system-preview-accent) 32%));
}

.theme-card-preview.wallpaper-tone.system-dark {
  --system-preview-base: #0f0f10;
  --cover-page: var(--system-preview-base);
  --cover-sidebar: color-mix(in srgb, var(--system-preview-base), white 6%);
  --cover-border: color-mix(in srgb, var(--system-preview-base), white 18%);
  --cover-selected: color-mix(in srgb, var(--system-preview-base), white 16%);
  --cover-line: #e8e8e8;
  --cover-line-soft: color-mix(in srgb, var(--system-preview-base), white 24%);
  color: #e8e8e8;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--cover-border) 42%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, var(--cover-page), color-mix(in srgb, var(--system-preview-base), white 7%));
}

.theme-card-preview {
  color: transparent;
  background: var(--cover-page, var(--smw-bg-panel));
}

</style>
