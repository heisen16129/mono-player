<script setup lang="ts">
defineProps<{
  message: string | null;
  variant: 'success' | 'error';
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Transition name="online-toast">
    <div v-if="message" class="online-toast" :class="`is-${variant}`" role="status">
      <span>{{ message }}</span>
      <button type="button" aria-label="关闭提示" @click="$emit('close')">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.online-toast {
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 520;
  display: inline-flex;
  align-items: flex-start;
  gap: 12px;
  max-width: min(420px, calc(100vw - 48px));
  padding: 12px 14px;
  border: 1px solid var(--smw-border-soft);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  font-size: 13px;
  line-height: 1.5;
}

.online-toast.is-success {
  border-color: color-mix(in srgb, var(--smw-accent-blue) 58%, var(--smw-border));
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-workspace) 84%, var(--smw-accent-blue));
}

.online-toast.is-error {
  border-color: var(--smw-error-border);
  color: var(--smw-error-text);
  background: var(--smw-error-bg);
}

.online-toast span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.online-toast button {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.online-toast button:hover {
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.online-toast-enter-active,
.online-toast-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.online-toast-enter-from,
.online-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
