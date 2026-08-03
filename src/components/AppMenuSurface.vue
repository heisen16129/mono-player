<script setup lang="ts">
import AppSidebarOutlet from './AppSidebarOutlet.vue';
import type { AppSidebarOutletListeners, AppSidebarOutletProps } from '../types/sidebar';

defineProps<{
  listeners: AppSidebarOutletListeners;
  props: AppSidebarOutletProps;
}>();
</script>

<template>
  <AppSidebarOutlet v-bind="{ ...props, ...listeners }" />
</template>
