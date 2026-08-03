<script setup lang="ts">
defineProps<{
  progressPercent: number;
}>();
</script>

<template>
  <div class="sleep-timer-status-progress" :style="{ '--timer-progress': `${progressPercent}%` }" aria-hidden="true">
    <i></i>
  </div>
</template>

<style scoped>
.sleep-timer-status-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, #1677ff 14%, transparent);
}

.sleep-timer-status-progress i {
  display: block;
  width: var(--timer-progress);
  height: 100%;
  border-radius: inherit;
  background: #1677ff;
}
</style>
