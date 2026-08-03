<script setup lang="ts">
import { computed } from 'vue';
import type { PluginPlaybackQuality, PluginPlaybackQualityOption } from '../../types/plugin';
import PlaybackOptionMenu from './PlaybackOptionMenu.vue';
import type { PlaybackOptionMenuItem } from './PlaybackOptionMenu.vue';

const props = defineProps<{
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

const onlineQualityMenuItems = computed<PlaybackOptionMenuItem[]>(() => props.onlineQualityOptions.map((option) => ({
  disabled: !option.available,
  id: option.id,
  label: option.name,
  title: option.reason ?? option.name,
})));

const lyricFormatMenuItems = computed<PlaybackOptionMenuItem[]>(() => props.lyricFormats.map((format) => ({
  id: format,
  label: format,
})));
</script>

<template>
  <PlaybackOptionMenu
    v-if="props.showOnlineQuality && props.onlineQualityOptions.length > 0"
    :active-value="props.onlineQuality"
    :button-label="props.onlineQualityLabel"
    :items="onlineQualityMenuItems"
    menu-label="插件音质"
    :trigger-label="`音质：${props.onlineQualityLabel}`"
    @select="emit('onlineQualityChange', $event as PluginPlaybackQuality)"
  />

  <PlaybackOptionMenu
    v-if="props.showLyricFormat && props.lyricFormats.length > 1"
    :active-value="props.lyricFormat"
    :button-label="props.lyricFormatLabel"
    :items="lyricFormatMenuItems"
    menu-label="歌词格式"
    :trigger-label="`歌词格式：${props.lyricFormatLabel}`"
    @select="emit('lyricFormatChange', $event)"
  />
</template>
