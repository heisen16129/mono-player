<script setup lang="ts">
defineProps<{
  devices: Array<{
    id: string;
    isDefault: boolean;
    name: string;
  }>;
  locale: string;
  value: string;
}>();

const emit = defineEmits<{
  change: [event: Event];
}>();
</script>

<template>
  <select :value="value" @change="emit('change', $event)">
    <option value="">{{ locale === 'en-US' ? 'System default' : '系统默认' }}</option>
    <option v-for="device in devices" :key="device.id" :value="device.id">
      {{ device.name }}{{ device.isDefault ? (locale === 'en-US' ? ' (default)' : '（默认）') : '' }}
    </option>
  </select>
</template>

<style scoped>
select {
  height: 36px;
  min-width: 0;
  padding: 0 38px 0 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  color: var(--smw-text-body);
  background:
    linear-gradient(45deg, transparent 50%, var(--smw-text-secondary) 50%) calc(100% - 17px) 15px / 6px 6px no-repeat,
    linear-gradient(135deg, var(--smw-text-secondary) 50%, transparent 50%) calc(100% - 12px) 15px / 6px 6px no-repeat,
    var(--smw-bg-input);
  cursor: pointer;
  outline: none;
  appearance: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

select:hover {
  border-color: var(--smw-text-muted);
}

select:focus {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
}
</style>
