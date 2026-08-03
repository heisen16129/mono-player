<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PluginSearchProvider } from '../../types/plugin';
import PluginSearchInput from './PluginSearchInput.vue';
import PluginProviderTabs from './PluginProviderTabs.vue';

const props = defineProps<{
  activeProviderId: string | null;
  loading: boolean;
  providers: PluginSearchProvider[];
  query: string;
}>();

const emit = defineEmits<{
  search: [keyword: string];
  selectProvider: [providerId: string];
}>();

const searchText = ref(props.query);

watch(
  () => props.query,
  (query) => {
    searchText.value = query;
  },
);

function submitSearch() {
  const keyword = searchText.value.trim();
  if (!keyword || props.loading) return;
  emit('search', keyword);
}

</script>

<template>
  <div class="plugin-search-top">
    <header class="plugin-search-header">
      <PluginSearchInput
        v-model="searchText"
        placeholder="搜索歌曲 / 歌手 / 专辑"
        enter-hint="按 Enter 搜索"
        @submit="submitSearch"
      />
    </header>

    <PluginProviderTabs
      label="插件来源"
      :loading="loading"
      :model-value="activeProviderId"
      :providers="providers"
      @select="emit('selectProvider', $event)"
    />

    <h1 class="result-title">搜索结果</h1>
  </div>
</template>

<style scoped>
.plugin-search-top {
  display: grid;
  width: min(980px, 100%);
  gap: 18px;
  margin: 0 0 0 22px;
}

.plugin-search-header {
  display: block;
}

.result-title {
  margin: 0;
  color: var(--smw-text-primary);
  font-size: 20px;
  font-weight: 760;
}

@media (max-width: 980px) {
  .plugin-search-top {
    width: 100%;
    margin-left: 0;
  }
}
</style>
