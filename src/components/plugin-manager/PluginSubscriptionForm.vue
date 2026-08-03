<script setup lang="ts">
import PluginSubscriptionSubmitButton from './PluginSubscriptionSubmitButton.vue';
import PluginSubscriptionUrlField from './PluginSubscriptionUrlField.vue';

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
    <PluginSubscriptionUrlField
      :disabled="adding"
      :model-value="modelValue"
      @add="emit('add')"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <PluginSubscriptionSubmitButton :adding="adding" :disabled="adding || !modelValue.trim()" @add="emit('add')" />
    <slot name="actions"></slot>
  </section>
</template>

<style scoped>
.subscription-row {
  display: grid;
  grid-template-columns: minmax(320px, 560px) 150px max-content;
  gap: 12px;
  align-items: end;
  justify-content: start;
  padding: 18px 0 8px;
}

@media (max-width: 860px) {
  .subscription-row {
    grid-template-columns: 1fr;
  }
}
</style>
