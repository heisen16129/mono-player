<script setup lang="ts">
defineProps<{
  isActive: boolean;
  isPaused: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  close: [];
  pause: [];
  resume: [];
  start: [];
}>();
</script>

<template>
  <footer class="sleep-timer-dialog-footer">
    <button v-if="isActive || isPaused" type="button" @click="isPaused ? emit('resume') : emit('pause')">
      {{ isPaused ? '继续计时' : '暂停计时' }}
    </button>
    <button v-else type="button" @click="emit('close')">取消</button>
    <button v-if="isActive || isPaused" type="button" @click="emit('clear')">取消定时</button>
    <button type="button" @click="emit('start')">确认开启</button>
  </footer>
</template>

<style scoped>
.sleep-timer-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 -16px -16px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--smw-border-soft);
}

.sleep-timer-dialog-footer button {
  flex: 1;
  height: 38px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-elevated);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.sleep-timer-dialog-footer button:last-child {
  color: #fff;
  border-color: var(--smw-button-primary);
  background: var(--smw-button-primary);
}

.sleep-timer-dialog-footer button:last-child:hover {
  filter: brightness(0.96);
}
</style>
