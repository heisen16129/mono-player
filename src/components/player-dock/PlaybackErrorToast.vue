<script setup lang="ts">
defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Transition name="playback-error">
    <div v-if="message" class="playback-error" role="alert">
      <span>{{ message }}</span>
      <button type="button" aria-label="关闭播放错误提示" @click="emit('close')">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.playback-error {
  position: absolute;
  z-index: 45;
  left: 50%;
  bottom: calc(100% + 10px);
  display: flex;
  max-width: min(520px, calc(100vw - 40px));
  align-items: center;
  gap: 12px;
  padding: 9px 10px 9px 12px;
  border: 1px solid rgba(220, 38, 38, 0.26);
  border-radius: 6px;
  color: #991b1b;
  background: rgba(254, 242, 242, 0.96);
  box-shadow: 0 12px 30px rgba(80, 20, 20, 0.16);
  transform: translateX(-50%);
}

.playback-error span {
  overflow: hidden;
  font-size: 13px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playback-error button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.playback-error button:hover {
  background: rgba(185, 28, 28, 0.1);
}

.playback-error-enter-active,
.playback-error-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.playback-error-enter-from,
.playback-error-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
