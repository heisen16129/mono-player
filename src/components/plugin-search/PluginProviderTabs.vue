<script setup lang="ts">
import { computed } from 'vue';
import type { PluginSearchProvider } from '../../types/plugin';
import SegmentTabs from '../SegmentTabs.vue';

const EMPTY_PROVIDER_TAB_ID = '__empty__';

const props = defineProps<{
  label: string;
  loading: boolean;
  modelValue: string | null;
  providers: PluginSearchProvider[];
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const providerTabItems = computed(() => (
  props.providers.length > 0
    ? props.providers.map((provider) => ({ id: provider.id, label: provider.name, disabled: !provider.enabled || props.loading }))
    : [{ id: EMPTY_PROVIDER_TAB_ID, label: '暂无插件', disabled: true }]
));

function selectProviderTab(providerId: string | null) {
  if (providerId && providerId !== EMPTY_PROVIDER_TAB_ID) emit('select', providerId);
}
</script>

<template>
  <SegmentTabs :items="providerTabItems" :label="label" :model-value="modelValue" root-class="provider-tabs" @select="selectProviderTab" />
</template>
