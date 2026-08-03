<script setup lang="ts">
import BaseDialog from '../BaseDialog.vue';
import SleepTimerActionOptions from './SleepTimerActionOptions.vue';
import SleepTimerCustomTimeInputs from './SleepTimerCustomTimeInputs.vue';
import SleepTimerDivider from './SleepTimerDivider.vue';
import SleepTimerDialogFooter from './SleepTimerDialogFooter.vue';
import SleepTimerPresetGrid from './SleepTimerPresetGrid.vue';
import SleepTimerSectionLabel from './SleepTimerSectionLabel.vue';

defineProps<{
  action: 'stop' | 'exit' | 'finishTrack';
  hours: number;
  isActive: boolean;
  isOpen: boolean;
  isPaused: boolean;
  minutes: number;
  presetMinutes: readonly number[];
}>();

const emit = defineEmits<{
  clear: [];
  close: [];
  pause: [];
  resume: [];
  setAction: [action: 'stop' | 'exit' | 'finishTrack'];
  setHours: [value: number];
  setMinutes: [value: number];
  setPreset: [minutes: number];
  start: [];
}>();

</script>

<template>
  <Teleport to="body">
    <BaseDialog
      v-if="isOpen"
      label="定时关闭"
      close-label="关闭"
      close-on-overlay
      title="定时关闭"
      panel-class="sleep-timer-dialog"
      width="min(478px, calc(100vw - 28px))"
      :z-index="500"
      @close="emit('close')"
    >
      <div class="sleep-timer-dialog-body">
        <SleepTimerSectionLabel>选择时长</SleepTimerSectionLabel>
        <SleepTimerPresetGrid :hours="hours" :minutes="minutes" :preset-minutes="presetMinutes" @set-preset="emit('setPreset', $event)" />

        <SleepTimerDivider />

        <SleepTimerCustomTimeInputs :hours="hours" :minutes="minutes" @set-hours="emit('setHours', $event)" @set-minutes="emit('setMinutes', $event)" />

        <SleepTimerSectionLabel>结束时执行</SleepTimerSectionLabel>
        <SleepTimerActionOptions :action="action" @set-action="emit('setAction', $event)" />

        <SleepTimerDialogFooter
          :is-active="isActive"
          :is-paused="isPaused"
          @clear="emit('clear')"
          @close="emit('close')"
          @pause="emit('pause')"
          @resume="emit('resume')"
          @start="emit('start')"
        />
      </div>
    </BaseDialog>
  </Teleport>
</template>

<style scoped>
:global(.sleep-timer-dialog) {
  color: var(--smw-text-primary);
}

.sleep-timer-dialog-body {
  display: grid;
  gap: 14px;
  padding: 16px;
}

</style>
