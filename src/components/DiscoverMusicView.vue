<script setup lang="ts">
import { Flame, UserRound } from '@lucide/vue';
import { computed } from 'vue';
import SearchInput from './SearchInput.vue';

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

const visibleKeywords = computed(() => props.searchHistory);

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

      <SearchInput v-model="query" root-class="discover-search" placeholder="搜索歌曲 / 歌手 / 专辑" :icon-size="24" @submit="submitSearch">
        <template #after>
          <kbd>Enter</kbd>
        </template>
      </SearchInput>

      <div class="quick-keywords" aria-label="快捷搜索">
        <button
          v-for="keyword in visibleKeywords"
          :key="keyword"
          type="button"
          @click="submitSearch(keyword)"
        >
          {{ keyword }}
        </button>
      </div>

      <div class="discover-actions">
        <button type="button" @click="submitSearch('热门歌曲')">
          <Flame :size="18" />
          <span>热门歌曲</span>
        </button>
        <button type="button" @click="submitSearch('热门歌手')">
          <UserRound :size="18" />
          <span>热门歌手</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.discover-music-view {
  display: grid;
  min-width: 0;
  min-height: 0;
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

.quick-keywords {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  width: min(760px, 100%);
  min-height: 54px;
  padding-top: 22px;
  border-top: 1px solid var(--smw-border);
}

.quick-keywords button,
.discover-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
  font: inherit;
  font-size: 15px;
  font-weight: 560;
  cursor: pointer;
}

.quick-keywords button {
  padding: 0 20px;
}

.discover-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
}

.discover-actions button {
  min-width: 150px;
  padding: 0 18px;
}

.quick-keywords button:hover,
.discover-actions button:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: var(--smw-bg-hover);
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
