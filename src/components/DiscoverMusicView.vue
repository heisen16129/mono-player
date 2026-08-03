<script setup lang="ts">
import { computed } from 'vue';
import DiscoverHotActions from './DiscoverHotActions.vue';
import DiscoverQuickKeywords from './DiscoverQuickKeywords.vue';
import DiscoverSearchInput from './DiscoverSearchInput.vue';

const props = defineProps<{
  modelValue: string;
  searchHistory: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [keyword: string];
}>();

const query = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

function submitSearch(keyword = query.value) {
  const value = keyword.trim();
  if (!value) return;

  query.value = value;
  emit('search', value);
}
</script>

<template>
  <section class="discover-music-view">
    <div class="discover-stage">
      <h1>发现音乐</h1>

      <DiscoverSearchInput v-model="query" placeholder="搜索歌曲 / 歌手 / 专辑" @submit="submitSearch" />

      <DiscoverQuickKeywords :keywords="searchHistory" @search="submitSearch" />

      <DiscoverHotActions @search="submitSearch" />
    </div>
  </section>
</template>

<style scoped>
.discover-music-view {
  display: grid;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  place-items: center;
  padding: 48px 32px 120px;
  overflow: auto;
  background:
    radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--smw-button-primary) 9%, transparent), transparent 30%),
    var(--smw-bg-workspace);
}

.discover-stage {
  display: grid;
  width: min(820px, 100%);
  justify-items: center;
  gap: 34px;
}

.discover-stage h1 {
  margin: 0 0 20px;
  color: var(--smw-text-primary);
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 780;
  letter-spacing: 0;
}

@media (max-width: 820px) {
  .discover-music-view {
    padding: 34px 18px 128px;
  }

  .discover-stage {
    gap: 24px;
  }
}
</style>
