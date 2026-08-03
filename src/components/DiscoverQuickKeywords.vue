<script setup lang="ts">
defineProps<{
  keywords: string[];
}>();

const emit = defineEmits<{
  search: [keyword: string];
}>();
</script>

<template>
  <div class="quick-keywords" aria-label="快捷搜索">
    <button v-for="keyword in keywords" :key="keyword" type="button" @click="emit('search', keyword)">
      {{ keyword }}
    </button>
  </div>
</template>

<style scoped>
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

.quick-keywords button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  gap: 9px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
  font: inherit;
  font-size: 15px;
  font-weight: 560;
  cursor: pointer;
}

.quick-keywords button:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: var(--smw-bg-hover);
}
</style>
