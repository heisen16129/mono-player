<script setup lang="ts">
import { RotateCcw } from '@lucide/vue';
import SpinnerIcon from '../SpinnerIcon.vue';

defineProps<{
  loadMoreError: string | null;
  loadingMore: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <p v-if="loadingMore" class="plugin-load-more-state">
    <SpinnerIcon :size="16" />
    正在加载更多...
  </p>
  <div v-else-if="loadMoreError" class="plugin-load-more-error">
    <span>{{ loadMoreError }}</span>
    <button class="secondary-button" type="button" @click="emit('retry')">
      <RotateCcw :size="15" />
      重试
    </button>
  </div>
</template>

<style scoped>
.plugin-load-more-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.plugin-load-more-error {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 46px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
