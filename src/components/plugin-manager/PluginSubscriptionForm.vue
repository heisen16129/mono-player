<script setup lang="ts">
import { Settings2 } from '@lucide/vue';

defineProps<{
  adding: boolean;
  modelValue: string;
}>();

const emit = defineEmits<{
  add: [];
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <section class="subscription-row" aria-label="插件订阅">
    <label>
      <span>订阅地址</span>
      <input
        :value="modelValue"
        type="url"
        :disabled="adding"
        placeholder="https://example.com/plugins.json 或 plugin.wasm"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="emit('add')"
      />
    </label>
    <button class="primary-button subscription-submit" type="button" :disabled="adding || !modelValue.trim()" @click="emit('add')">
      <Settings2 :size="16" />
      <span>{{ adding ? '添加中...' : '添加订阅' }}</span>
    </button>
    <slot name="actions"></slot>
  </section>
</template>

<style scoped>
.subscription-submit {
  height: 36px;
  font-size: 0;
}

.subscription-submit span {
  font-size: 13px;
}

.subscription-row {
  display: grid;
  grid-template-columns: minmax(320px, 560px) 150px max-content;
  gap: 12px;
  align-items: end;
  justify-content: start;
  padding: 18px 0 8px;
}

.subscription-row label {
  display: grid;
  gap: 8px;
}

.subscription-row label > span {
  color: var(--smw-text-secondary);
  font-size: 12px;
  font-weight: 560;
}

.subscription-row input {
  height: 36px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background: var(--smw-bg-input);
  font: inherit;
  outline: none;
}

.subscription-row input:focus {
  border-color: var(--smw-text-primary);
  box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
}

.subscription-row input:disabled {
  cursor: wait;
  opacity: 0.72;
}

@media (max-width: 860px) {
  .subscription-row {
    grid-template-columns: 1fr;
  }
}
</style>
