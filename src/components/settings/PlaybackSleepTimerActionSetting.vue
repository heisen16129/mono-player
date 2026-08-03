<script setup lang="ts">
import type { PlayerSettings } from '../../types/music';

defineProps<{
  action: PlayerSettings['sleepTimerAction'];
}>();

const emit = defineEmits<{
  setAction: [action: PlayerSettings['sleepTimerAction']];
}>();
</script>

<template>
  <div class="setting-group">
    <p>定时关闭后</p>
    <div class="inline-options">
      <label class="option-row">
        <input
          type="radio"
          name="sleep-timer-action"
          :checked="action === 'stop'"
          @change="emit('setAction', 'stop')"
        />
        停止播放
      </label>
      <label class="option-row">
        <input
          type="radio"
          name="sleep-timer-action"
          :checked="action === 'exit'"
          @change="emit('setAction', 'exit')"
        />
        退出程序
      </label>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: grid;
  gap: 8px;
}

.setting-group p {
  margin: 0;
  color: var(--smw-text-body);
  font-size: 13px;
}

.inline-options {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 44px;
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

.option-row input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
