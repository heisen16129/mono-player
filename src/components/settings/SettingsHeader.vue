<script setup lang="ts">
import { SlidersHorizontal, X } from '@lucide/vue';

defineProps<{
  title: string;
  locale: string;
}>();
defineEmits<{ close: [] }>();
</script>

<template>
  <header class="settings-header">
    <div class="settings-heading">
      <SlidersHorizontal :size="18" aria-hidden="true" />
      <h1>{{ title }}</h1>
    </div>
    <button class="icon-button settings-close" type="button" :aria-label="locale === 'en-US' ? 'Close settings' : '关闭设置'" @click="$emit('close')">
      <X :size="18" />
    </button>
  </header>
</template>

<style scoped>
.settings-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 18px;
}

.settings-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--smw-text-primary);
}

.settings-heading > svg {
  margin-top: 3px;
}

h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1.4;
  font-weight: 700;
}

.settings-close {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.settings-close:hover {
  background: var(--smw-bg-hover);
}
</style>
