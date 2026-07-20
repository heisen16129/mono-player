<script setup lang="ts">
import { Check, Plus, Trash2 } from '@lucide/vue';
import { t } from '../../i18n';
import type { AppTheme, CustomTheme, Locale } from '../../types/music';
import type { BuiltInThemeCard } from './types';

defineProps<{
  customPreviewSrc: (theme: CustomTheme) => string;
  customPreviewStyle: (variables: Record<string, string>) => Record<string, string>;
  customThemeCards: CustomTheme[];
  deleteThemeText: string;
  importThemeText: string;
  localThemeCards: BuiltInThemeCard[];
  locale: Locale;
  selectedTheme: AppTheme;
  systemThemePreviewStyle: Record<string, string>;
  themePackageText: string;
}>();

const emit = defineEmits<{
  importTheme: [];
  removeCustomTheme: [themeId: `custom:${string}`];
  selectTheme: [theme: AppTheme];
}>();
</script>

<template>
  <div class="theme-grid-list">
    <button class="theme-card theme-import-card" type="button" @click="emit('importTheme')">
      <span class="theme-card-preview theme-card-import-preview">
        <Plus :size="42" />
      </span>
      <strong>{{ importThemeText }}</strong>
      <small>{{ themePackageText }}</small>
    </button>

    <button
      v-for="theme in localThemeCards"
      :key="theme.value"
      class="theme-card"
      :class="{ selected: selectedTheme === theme.value }"
      type="button"
      @click.stop="emit('selectTheme', theme.value)"
    >
      <span
        class="theme-card-preview"
        :class="theme.tone"
        :style="theme.value === 'wallpaperTone' ? systemThemePreviewStyle : undefined"
      >
        <img v-if="theme.previewUrl" class="theme-card-image" :src="theme.previewUrl" alt="" draggable="false" />
        <span class="theme-card-cover" aria-hidden="true"></span>
        <Check v-if="selectedTheme === theme.value" class="theme-card-check" :size="18" />
      </span>
      <strong>{{ theme.title }}</strong>
      <small>{{ t(locale, 'author') }}: {{ theme.author }}</small>
    </button>

    <article
      v-for="theme in customThemeCards"
      :key="theme.id"
      class="theme-card"
      :class="{ selected: selectedTheme === theme.id }"
      role="button"
      tabindex="0"
      @click.stop="emit('selectTheme', theme.id)"
      @keydown.enter.stop.prevent="emit('selectTheme', theme.id)"
      @keydown.space.stop.prevent="emit('selectTheme', theme.id)"
    >
      <span class="theme-card-preview custom-theme-preview" :style="customPreviewStyle(theme.variables)">
        <img
          v-if="customPreviewSrc(theme)"
          class="theme-card-image"
          :src="customPreviewSrc(theme)"
          alt=""
          draggable="false"
        />
        <span v-else class="theme-card-cover" aria-hidden="true"></span>
        <button
          class="theme-card-delete"
          type="button"
          :aria-label="deleteThemeText"
          :title="deleteThemeText"
          @click.stop="emit('removeCustomTheme', theme.id)"
          @keydown.enter.stop.prevent="emit('removeCustomTheme', theme.id)"
          @keydown.space.stop.prevent="emit('removeCustomTheme', theme.id)"
        >
          <Trash2 :size="14" />
        </button>
        <Check v-if="selectedTheme === theme.id" class="theme-card-check" :size="18" />
      </span>
      <strong>{{ theme.name }}</strong>
      <small>{{ t(locale, 'author') }}: {{ theme.author }}</small>
    </article>
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

.theme-card:not(.theme-import-card) .theme-card-preview,
.custom-theme-preview {
  color: transparent;
  background: var(--cover-page, var(--smw-bg-panel));
}

.theme-card-cover {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--cover-sidebar), var(--cover-sidebar)) 0 0 / 42px 100% no-repeat,
    linear-gradient(var(--cover-border), var(--cover-border)) 42px 0 / 1px 100% no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 9px 15px / 24px 11px no-repeat,
    linear-gradient(var(--cover-line), var(--cover-line)) 55px 15px / 34px 5px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 27px / 70px 4px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 39px / 58px 4px no-repeat,
    linear-gradient(var(--cover-selected), var(--cover-selected)) 55px 56px / 76px 13px no-repeat,
    linear-gradient(var(--cover-line-soft), var(--cover-line-soft)) 55px 76px / 64px 4px no-repeat,
    var(--cover-page);
}

.theme-card-image {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.theme-card-image + .theme-card-cover {
  display: none;
}

.theme-card-cover::before,
.theme-card-cover::after {
  position: absolute;
  content: "";
}

.theme-card-preview.blue-white .theme-card-cover::before,
.theme-card-preview.wallpaper-tone .theme-card-cover::before,
.custom-theme-preview .theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--cover-line) 14%, transparent);
}

.theme-card-preview.blue-white .theme-card-cover::after,
.theme-card-preview.wallpaper-tone .theme-card-cover::after,
.custom-theme-preview .theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cover-line) 18%, transparent);
}

.theme-card-import-preview {
  border-style: dashed;
  color: var(--smw-icon-muted);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--smw-border-soft) 70%, transparent) 1px, transparent 1px) 0 0 / 18px 18px,
    var(--smw-bg-panel);
}

.theme-import-card:hover .theme-card-import-preview {
  color: var(--smw-text-primary);
}

.theme-card-check {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 50%;
  color: #ffffff;
  background: var(--smw-button-primary);
}

.theme-card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  display: grid;
  width: 23px;
  height: 23px;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--smw-border) 72%, transparent);
  border-radius: 50%;
  color: var(--smw-text-secondary);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 140ms ease,
    color 140ms ease,
    background 140ms ease;
}

.theme-card:hover .theme-card-delete,
.theme-card:focus-within .theme-card-delete {
  opacity: 1;
  pointer-events: auto;
}

.theme-card-delete:hover,
.theme-card-delete:focus-visible {
  color: #e5484d;
  background: color-mix(in srgb, #e5484d 12%, var(--smw-bg-panel));
  outline: none;
}

.theme-card strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-card small {
  overflow: hidden;
  color: var(--smw-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
