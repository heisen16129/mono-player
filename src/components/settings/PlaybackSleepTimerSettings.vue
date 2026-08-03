<script setup lang="ts">
import type { PlayerSettings } from '../../types/music';
import PlaybackSleepTimerActionSetting from './PlaybackSleepTimerActionSetting.vue';
import PlaybackSleepTimerMinutesSetting from './PlaybackSleepTimerMinutesSetting.vue';

defineProps<{
  sleepTimerAction: PlayerSettings['sleepTimerAction'];
  sleepTimerMinutes: number;
}>();

const emit = defineEmits<{
  setSleepTimerAction: [action: PlayerSettings['sleepTimerAction']];
  setSleepTimerMinutes: [value: number];
}>();
</script>

<template>
  <PlaybackSleepTimerMinutesSetting
    :minutes="sleepTimerMinutes"
    @set-minutes="emit('setSleepTimerMinutes', $event)"
  />

  <PlaybackSleepTimerActionSetting
    :action="sleepTimerAction"
    @set-action="emit('setSleepTimerAction', $event)"
  />
</template>
