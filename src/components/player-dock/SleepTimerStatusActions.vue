<script setup lang="ts">
defineProps<{
  isPaused: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  pause: [];
  resume: [];
}>();
</script>

<template>
  <div class="sleep-timer-status-actions">
    <button type="button" @click="isPaused ? emit('resume') : emit('pause')">
      {{ isPaused ? '继续计时' : '暂停计时' }}
    </button>
    <button type="button" @click="emit('clear')">取消定时</button>
  </div>
</template>

<style scoped>
.sleep-timer-status-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sleep-timer-status-actions button {
  height: 36px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 6px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.sleep-timer-status-actions button:last-child {
  color: #ef4444;
  border-color: #ef4444;
  background: transparent;
}
</style>
