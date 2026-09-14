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
  <details class="sleep-timer-settings" open>
    <summary>
      <span>定时关闭</span>
      <small>默认时间与结束后的操作</small>
    </summary>
    <div class="sleep-timer-body">
      <PlaybackSleepTimerMinutesSetting
        :minutes="sleepTimerMinutes"
        @set-minutes="emit('setSleepTimerMinutes', $event)"
      />

      <PlaybackSleepTimerActionSetting
        :action="sleepTimerAction"
        @set-action="emit('setSleepTimerAction', $event)"
      />
    </div>
  </details>
</template>

<style scoped>
.sleep-timer-settings {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 12px;
  background: var(--smw-bg-panel);
}

summary {
  position: relative;
  padding-right: 20px;
  list-style: none;
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

summary::-webkit-details-marker { display: none; }
summary::after { content: '▸'; position: absolute; right: 0; top: 0; }
.sleep-timer-settings[open] > summary::after { content: '▾'; }

summary small {
  display: block;
  margin-top: 3px;
  color: var(--smw-text-secondary);
  font-size: 11px;
  font-weight: 400;
}

.sleep-timer-body {
  display: grid;
  gap: 14px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 9px;
  background: var(--smw-bg-input);
}

.sleep-timer-body :deep(.field-row > span:first-child),
.sleep-timer-body :deep(.setting-group > p) {
  font-size: 12px;
  font-weight: 650;
}
</style>
