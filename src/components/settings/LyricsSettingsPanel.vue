<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { usePlayerStore } from '../../stores/player';

const player = usePlayerStore();
const locale = computed(() => player.settings.locale);
const lyricFontSizeOptions = Array.from({ length: 21 }, (_, index) => String(index + 14));

function setLyricFontSize(event: Event) {
  player.setLyricFontSize(Number((event.target as HTMLSelectElement).value));
}

function setLyricFontColor(event: Event) {
  player.setLyricFontColor((event.target as HTMLInputElement).value);
}
</script>

<template>
  <section class="settings-section">
    <h2>{{ t(locale, 'lyrics') }}</h2>
    <label class="option-row">
      <input
        type="checkbox"
        :checked="player.settings.autoHideLyricsDock"
        @change="player.setAutoHideLyricsDock(($event.target as HTMLInputElement).checked)"
      />
      {{ t(locale, 'autoHideLyricsDock') }}
    </label>
    <label class="field-row">
      <span>{{ t(locale, 'fontSize') }}</span>
      <select :value="player.settings.lyricFontSize" @change="setLyricFontSize">
        <option v-for="option in lyricFontSizeOptions" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>
    <label class="field-row">
      <span>{{ t(locale, 'fontColor') }}</span>
      <label class="option-row">
        <input
          type="checkbox"
          :checked="player.settings.useThemeLyricColor"
          @change="player.setUseThemeLyricColor(($event.target as HTMLInputElement).checked)"
        />
        {{ t(locale, 'useThemeColor') }}
      </label>
      <span class="color-field">
        <input
          v-if="!player.settings.useThemeLyricColor"
          type="color"
          :value="player.settings.lyricFontColor"
          :aria-label="t(locale, 'fontColor')"
          @input="setLyricFontColor"
        />
        <small v-if="!player.settings.useThemeLyricColor">{{ player.settings.lyricFontColor }}</small>
      </span>
    </label>
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--smw-border);
}

.settings-section h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 720;
}

.field-row span {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}

.field-row {
  display: grid;
  gap: 8px;
  max-width: 280px;
}

.field-row select {
  height: 36px;
  min-width: 0;
  padding: 0 38px 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background:
    linear-gradient(45deg, transparent 50%, var(--smw-text-secondary) 50%) calc(100% - 17px) 15px / 6px 6px no-repeat,
    linear-gradient(135deg, var(--smw-text-secondary) 50%, transparent 50%) calc(100% - 12px) 15px / 6px 6px no-repeat,
    var(--smw-bg-input);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.field-row select:hover {
  border-color: var(--smw-text-muted);
}

.field-row select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}

.color-field {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 28px;
}

.color-field input {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.color-field input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-field input::-webkit-color-swatch {
  border: 0;
  border-radius: 2px;
}

.color-field small {
  color: var(--smw-text-body);
  font-size: 13px;
}
</style>
