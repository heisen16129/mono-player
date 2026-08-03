<script setup lang="ts">
import type { PluginCapability } from '../../types/plugin';

const props = defineProps<{
  capabilities: PluginCapability[];
  formatCapabilities: (capabilities: PluginCapability[], installed?: boolean) => string;
  installed?: boolean;
}>();

function capabilitiesLabel() {
  return props.formatCapabilities(props.capabilities, props.installed);
}
</script>

<template>
  <span class="capabilities" :title="capabilitiesLabel()">
    {{ capabilitiesLabel() }}
  </span>
</template>

<style scoped>
.capabilities {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
