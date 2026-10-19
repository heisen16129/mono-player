<script setup lang="ts">
import BaseDialog from '../BaseDialog.vue';
import StemSeparationContent from './StemSeparationContent.vue';
defineProps<{ pluginId: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <BaseDialog title="人声 / 伴奏分离" label="人声 / 伴奏分离" close-label="关闭" width="min(560px, calc(100vw - 32px))" max-height="85vh" overflow="auto" @close="$emit('close')">
    <StemSeparationContent :plugin-id="pluginId" />
  </BaseDialog>
</template>
