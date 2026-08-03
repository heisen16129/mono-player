<script setup lang="ts">
import { X } from '@lucide/vue';
import SleepTimerStatusActions from './SleepTimerStatusActions.vue';
import SleepTimerStatusProgress from './SleepTimerStatusProgress.vue';

defineProps<{
  executeAtLabel: string;
  isPaused: boolean;
  progressPercent: number;
  remainingLabel: string;
}>();

defineEmits<{
  clear: [];
  close: [];
  pause: [];
  resume: [];
}>();
</script>

<template>
  <div class="sleep-timer-status" role="dialog" aria-label="定时关闭状态">
    <header>
      <strong>定时关闭</strong>
      <button type="button" aria-label="关闭" @click="$emit('close')">
        <X :size="15" />
      </button>
    </header>
    <SleepTimerStatusProgress :progress-percent="progressPercent" />
    <p>
      剩余 {{ remainingLabel }}
      <span v-if="executeAtLabel">· 将于 {{ executeAtLabel }} 执行</span>
    </p>
    <SleepTimerStatusActions
      :is-paused="isPaused"
      @clear="$emit('clear')"
      @pause="$emit('pause')"
      @resume="$emit('resume')"
    />
  </div>
</template>

<style scoped>
.sleep-timer-status {
  position: absolute;
  right: -12px;
  bottom: 36px;
  z-index: 44;
  display: grid;
  gap: 10px;
  width: 282px;
  padding: 14px 12px 12px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-player-bg);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.14);
}

.sleep-timer-status header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sleep-timer-status strong {
  color: var(--smw-text-primary);
  font-size: 15px;
  font-weight: 650;
}

.sleep-timer-status header button {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  cursor: pointer;
}

.sleep-timer-status p {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

</style>
