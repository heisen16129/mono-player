<script setup lang="ts">
import SleepTimerDialog from './SleepTimerDialog.vue';
import SleepTimerStatusPopover from './SleepTimerStatusPopover.vue';
import SleepTimerTriggerButton from './SleepTimerTriggerButton.vue';

defineProps<{
  action: 'stop' | 'exit' | 'finishTrack';
  executeAtLabel: string;
  hours: number;
  isActive: boolean;
  isDialogOpen: boolean;
  isPaused: boolean;
  isStatusOpen: boolean;
  minutes: number;
  presetMinutes: readonly number[];
  progressPercent: number;
  remainingLabel: string;
}>();

defineEmits<{
  clear: [];
  closeDialog: [];
  closeStatus: [];
  pause: [];
  resume: [];
  setAction: [action: 'stop' | 'exit' | 'finishTrack'];
  setHours: [value: number];
  setMinutes: [value: number];
  setPreset: [minutes: number];
  start: [];
  toggle: [];
}>();
</script>

<template>
  <div class="sleep-timer-control">
    <SleepTimerStatusPopover
      v-if="isStatusOpen"
      :execute-at-label="executeAtLabel"
      :is-paused="isPaused"
      :progress-percent="progressPercent"
      :remaining-label="remainingLabel"
      @clear="$emit('clear')"
      @close="$emit('closeStatus')"
      @pause="$emit('pause')"
      @resume="$emit('resume')"
    />

    <SleepTimerTriggerButton
      :is-active="isActive"
      :is-paused="isPaused"
      :remaining-label="remainingLabel"
      @toggle="$emit('toggle')"
    />
  </div>

  <SleepTimerDialog
    :action="action"
    :hours="hours"
    :is-active="isActive"
    :is-open="isDialogOpen"
    :is-paused="isPaused"
    :minutes="minutes"
    :preset-minutes="presetMinutes"
    @clear="$emit('clear')"
    @close="$emit('closeDialog')"
    @pause="$emit('pause')"
    @resume="$emit('resume')"
    @set-action="$emit('setAction', $event)"
    @set-hours="$emit('setHours', $event)"
    @set-minutes="$emit('setMinutes', $event)"
    @set-preset="$emit('setPreset', $event)"
    @start="$emit('start')"
  />
</template>

<style scoped>
.sleep-timer-control {
  position: relative;
  display: grid;
  place-items: center;
}

</style>
