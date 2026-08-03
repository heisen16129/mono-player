<script setup lang="ts">
type SleepTimerDialogAction = 'stop' | 'exit' | 'finishTrack';

defineProps<{
  action: SleepTimerDialogAction;
}>();

const emit = defineEmits<{
  setAction: [action: SleepTimerDialogAction];
}>();
</script>

<template>
  <div class="sleep-timer-action-options">
    <label>
      <input type="radio" name="sleep-timer-action" value="exit" :checked="action === 'exit'" @change="emit('setAction', 'exit')" />
      <span>停止播放并退出程序</span>
    </label>
    <label>
      <input type="radio" name="sleep-timer-action" value="stop" :checked="action === 'stop'" @change="emit('setAction', 'stop')" />
      <span>仅停止播放（保持程序运行）</span>
    </label>
    <label>
      <input type="radio" name="sleep-timer-action" value="finishTrack" :checked="action === 'finishTrack'" @change="emit('setAction', 'finishTrack')" />
      <span>播放完整首歌后停止</span>
    </label>
  </div>
</template>

<style scoped>
.sleep-timer-action-options {
  display: grid;
  overflow: hidden;
  border-radius: 8px;
}

.sleep-timer-action-options label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 38px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--smw-bg-selected) 36%, transparent);
  cursor: pointer;
}

.sleep-timer-action-options input {
  width: 16px;
  height: 16px;
  accent-color: var(--smw-button-primary);
}
</style>
