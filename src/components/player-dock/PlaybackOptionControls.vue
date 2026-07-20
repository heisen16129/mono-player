<script setup lang="ts">
import { ref } from 'vue';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../../types/plugin';

defineProps<{
  lyricFormat: string | null;
  lyricFormatLabel: string;
  lyricFormats: string[];
  onlineQuality: PluginPlaybackQuality;
  onlineQualityLabel: string;
  onlineQualityOptions: PluginPlaybackQualityOption[];
  showLyricFormat: boolean;
  showOnlineQuality: boolean;
}>();

const emit = defineEmits<{
  lyricFormatChange: [format: string];
  onlineQualityChange: [quality: PluginPlaybackQuality];
}>();

const qualityControl = ref<HTMLElement | null>(null);
const lyricFormatControl = ref<HTMLElement | null>(null);

function closeControlPopover(control: HTMLElement | null) {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && control?.contains(activeElement)) {
    activeElement.blur();
  }
}
</script>

<template>
  <div v-if="showOnlineQuality && onlineQualityOptions.length > 0" ref="qualityControl" class="quality-control" @mouseleave="closeControlPopover(qualityControl)">
    <div class="quality-popover" role="menu" aria-label="插件音质">
      <button
        v-for="option in onlineQualityOptions"
        :key="option.id"
        type="button"
        role="menuitemradio"
        :class="{ 'is-active': onlineQuality === option.id }"
        :aria-checked="onlineQuality === option.id"
        :disabled="!option.available"
        :title="option.reason ?? option.name"
        @click="option.available && emit('onlineQualityChange', option.id as PluginPlaybackQuality)"
      >
        {{ option.name }}
      </button>
    </div>
    <button class="quality-button" type="button" :aria-label="`音质：${onlineQualityLabel}`" :title="`音质：${onlineQualityLabel}`">
      <span>{{ onlineQualityLabel }}</span>
    </button>
  </div>

  <div v-if="showLyricFormat && lyricFormats.length > 1" ref="lyricFormatControl" class="quality-control" @mouseleave="closeControlPopover(lyricFormatControl)">
    <div class="quality-popover" role="menu" aria-label="歌词格式">
      <button
        v-for="format in lyricFormats"
        :key="format"
        type="button"
        role="menuitemradio"
        :class="{ 'is-active': lyricFormat === format }"
        :aria-checked="lyricFormat === format"
        @click="emit('lyricFormatChange', format)"
      >
        {{ format }}
      </button>
    </div>
    <button class="quality-button" type="button" :aria-label="`歌词格式：${lyricFormatLabel}`" :title="`歌词格式：${lyricFormatLabel}`">
      <span>{{ lyricFormatLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.quality-control {
  position: relative;
  display: grid;
  place-items: center;
}

.quality-control:hover,
.quality-control:focus-within {
  z-index: 44;
}

.quality-control::before {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 92px;
  height: 26px;
  content: "";
  transform: translateX(-50%);
}

.quality-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-button-primary-text, #fff);
  background: var(--smw-button-primary);
  box-shadow: 0 6px 14px color-mix(in srgb, var(--smw-button-primary) 22%, transparent);
  font: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.quality-button:hover,
.quality-button:focus-visible {
  outline: none;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--smw-button-primary) 28%, transparent);
}

.quality-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 12px);
  z-index: 20;
  display: grid;
  min-width: 86px;
  padding: 6px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 10px;
  color: var(--smw-text-body);
  background: var(--smw-player-bg);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.quality-control:hover .quality-popover,
.quality-control:focus-within .quality-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.quality-popover button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border: 0;
  border-radius: 7px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.quality-popover button:hover,
.quality-popover button:focus-visible {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
  outline: none;
}

.quality-popover button.is-active {
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 12%, transparent);
  font-weight: 700;
}
</style>
