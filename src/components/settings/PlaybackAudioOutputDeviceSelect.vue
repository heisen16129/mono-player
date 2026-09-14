<script setup lang="ts">
import { computed } from 'vue';
import SettingsOptionSelect from './SettingsOptionSelect.vue';
const props = defineProps<{
  devices: { id: string; name: string; isDefault: boolean }[];
  locale: string;
  value: string;
}>();
const emit = defineEmits<{ change: [value: string] }>();
const options = computed(() => [
  { id: '', name: props.locale === 'en-US' ? 'System default' : '系统默认', isDefault: false },
  ...props.devices,
]);
</script>

<template>
  <SettingsOptionSelect :options="options" :locale="locale" :value="value" :label="locale === 'en-US' ? 'Output devices' : '输出设备'" @change="emit('change', $event)">
    <slot />
  </SettingsOptionSelect>
</template>