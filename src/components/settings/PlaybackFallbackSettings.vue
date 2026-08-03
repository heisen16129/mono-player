<script setup lang="ts">
import type { Locale, OnlinePlaybackFailureAction, PlaybackQualityFallback } from '../../types/music';
import PlaybackFailureActionSetting from './PlaybackFailureActionSetting.vue';
import PlaybackQualityFallbackSetting from './PlaybackQualityFallbackSetting.vue';

defineProps<{
  locale: Locale;
  onlinePlaybackFailureAction: OnlinePlaybackFailureAction;
  qualityFallback: PlaybackQualityFallback;
}>();

const emit = defineEmits<{
  setOnlinePlaybackFailureAction: [action: OnlinePlaybackFailureAction];
  setQualityFallback: [fallback: PlaybackQualityFallback];
}>();

const qualityFallbackOptions = [
  { value: 'lower', label: '自动降级' },
  { value: 'higher', label: '自动升级' },
  { value: 'none', label: '不重试' },
] as const satisfies readonly { value: PlaybackQualityFallback; label: string }[];
const playbackFailureOptions = [
  { value: 'pause', label: '暂停播放' },
  { value: 'next', label: '自动播放下一首' },
] as const satisfies readonly { value: OnlinePlaybackFailureAction; label: string }[];
</script>

<template>
  <PlaybackQualityFallbackSetting
    :locale="locale"
    :options="qualityFallbackOptions"
    :quality-fallback="qualityFallback"
    @set-quality-fallback="emit('setQualityFallback', $event)"
  />

  <PlaybackFailureActionSetting
    :online-playback-failure-action="onlinePlaybackFailureAction"
    :options="playbackFailureOptions"
    @set-online-playback-failure-action="emit('setOnlinePlaybackFailureAction', $event)"
  />
</template>
