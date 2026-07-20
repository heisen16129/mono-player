<script setup lang="ts">
import { Check } from '@lucide/vue';
import { t } from '../../i18n';
import type { AppTheme, CustomTheme, Locale } from '../../types/music';
import type { MarketThemeCard } from './types';

defineProps<{
  downloadedText: string;
  downloadOnlyText: string;
  downloadUseText: string;
  isMarketThemeInstalled: (themeId: CustomTheme['id']) => boolean;
  locale: Locale;
  marketThemeCards: MarketThemeCard[];
  selectedTheme: AppTheme;
  useThemeText: string;
}>();

const emit = defineEmits<{
  installMarketTheme: [theme: MarketThemeCard, useImmediately: boolean];
  useOrInstallMarketTheme: [theme: MarketThemeCard];
}>();
</script>

<template>
  <div class="theme-grid-list">
    <article
      v-for="theme in marketThemeCards"
      :key="theme.id"
      class="theme-card market-theme-card"
      :class="{ selected: selectedTheme === theme.id }"
    >
      <span class="theme-card-preview" :class="theme.tone">
        <img class="theme-card-image" :src="theme.previewUrl" alt="" draggable="false" />
        <span class="theme-card-cover" aria-hidden="true"></span>
        <span class="theme-card-actions">
          <button
            class="theme-card-action"
            :class="{ installed: isMarketThemeInstalled(theme.id) }"
            type="button"
            :disabled="isMarketThemeInstalled(theme.id)"
            @click.stop="emit('installMarketTheme', theme, false)"
          >
            {{ isMarketThemeInstalled(theme.id) ? downloadedText : downloadOnlyText }}
          </button>
          <button
            class="theme-card-action primary"
            type="button"
            @click.stop="emit('useOrInstallMarketTheme', theme)"
          >
            {{ isMarketThemeInstalled(theme.id) ? useThemeText : downloadUseText }}
          </button>
        </span>
        <Check v-if="selectedTheme === theme.id" class="theme-card-check" :size="18" />
      </span>
      <strong>{{ theme.title }}</strong>
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

.theme-card.selected .theme-card-preview {
  border-color: color-mix(in srgb, var(--smw-button-primary) 62%, var(--smw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--smw-button-primary) 18%, transparent);
}

.theme-card-preview.light {
  --cover-page: #f7f7f7;
  --cover-sidebar: #ffffff;
  --cover-border: #e3e3e3;
  --cover-selected: #e9e9e9;
  --cover-line: #909090;
  --cover-line-soft: #d5d5d5;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #ffffff, #f2f2f2);
}

.theme-card-preview.dark {
  --cover-page: #151515;
  --cover-sidebar: #101010;
  --cover-border: #303030;
  --cover-selected: #2e2e2e;
  --cover-line: #8d8d8d;
  --cover-line-soft: #444444;
  color: #f5f5f5;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(135deg, #101010, #2c2c2c);
}

.theme-card-preview.desktop-glass {
  --cover-page: rgba(245, 251, 255, 0.54);
  --cover-sidebar: rgba(255, 255, 255, 0.58);
  --cover-border: rgba(17, 24, 39, 0.12);
  --cover-selected: rgba(255, 255, 255, 0.48);
  --cover-line: rgba(31, 41, 55, 0.42);
  --cover-line-soft: rgba(31, 41, 55, 0.16);
  color: var(--smw-button-primary);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.22) 1px, transparent 1px) 0 0 / 18px 18px,
    radial-gradient(circle at 26% 34%, rgba(255, 255, 255, 0.5), transparent 34%),
    radial-gradient(circle at 76% 62%, rgba(210, 236, 255, 0.38), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.22));
}

.theme-card:not(.theme-import-card) .theme-card-preview {
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

.theme-card-preview.light .theme-card-cover::before,
.theme-card-preview.desktop-glass .theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--cover-line) 14%, transparent);
}

.theme-card-preview.light .theme-card-cover::after,
.theme-card-preview.desktop-glass .theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cover-line) 18%, transparent);
}

.theme-card-preview.dark .theme-card-cover::before {
  right: 14px;
  bottom: 13px;
  width: 28px;
  height: 18px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
}

.theme-card-preview.dark .theme-card-cover::after {
  right: 18px;
  top: 15px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
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

.theme-card-actions {
  position: absolute;
  right: auto;
  top: 50%;
  bottom: auto;
  left: 50%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 5px;
  opacity: 0;
  transform: translate(-50%, calc(-50% + 2px));
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.theme-card-action {
  max-width: 82px;
  min-height: 26px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--smw-border) 70%, transparent);
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-panel) 88%, transparent);
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 140ms ease,
    background 140ms ease;
}

.theme-card:hover .theme-card-actions,
.theme-card:focus-within .theme-card-actions {
  opacity: 1;
  transform: translate(-50%, -50%);
}

.theme-card-action.primary,
.theme-card-action.installed {
  color: #ffffff;
  background: var(--smw-button-primary);
}

.theme-card-action:disabled {
  cursor: default;
}

.market-theme-card.selected .theme-card-check {
  top: 8px;
  bottom: auto;
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
