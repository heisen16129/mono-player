<script setup lang="ts">
defineProps<{
  checked: boolean;
  label: string;
}>();

const emit = defineEmits<{
  change: [value: boolean];
}>();

function setChecked(event: Event) {
  emit('change', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="option-row">
    <input
      type="checkbox"
      :checked="checked"
      @change="setChecked"
    />
    {{ label }}
  </label>
</template>

<style scoped>
.option-row {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  color: var(--smw-text-body);
  font-size: 14px;
  line-height: 1.2;
}

.option-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--smw-button-primary);
}
</style>
