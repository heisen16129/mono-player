<script setup lang="ts">
defineProps<{
  keywords: string[];
}>();

const emit = defineEmits<{
  remove: [keyword: string];
  search: [keyword: string];
}>();
</script>

<template>
  <div class="quick-keywords" aria-label="快捷搜索">
    <div v-for="keyword in keywords" :key="keyword" class="quick-keyword-chip">
      <button type="button" class="quick-keyword-search" @click="emit('search', keyword)">
        {{ keyword }}
      </button>
      <button type="button" class="quick-keyword-remove" :aria-label="`删除 ${keyword}`" @click.stop="emit('remove', keyword)">
        <span aria-hidden="true"></span>
      </button>
    </div>
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

.quick-keyword-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
}

.quick-keyword-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 15px;
  font-weight: 560;
  cursor: pointer;
}

.quick-keyword-chip:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 24%, var(--smw-border));
  background: var(--smw-bg-hover);
}

.quick-keyword-remove {
  position: absolute;
  right: -5px;
  top: -5px;
  z-index: 1;
  display: block;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--smw-border);
  border-radius: 999px;
  box-sizing: border-box;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-panel);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity 120ms ease;
}

.quick-keyword-chip:hover .quick-keyword-remove,
.quick-keyword-chip:focus-within .quick-keyword-remove {
  opacity: 1;
  pointer-events: auto;
}

.quick-keyword-remove:hover {
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-hover) 70%, transparent);
}

.quick-keyword-remove::before,
.quick-keyword-remove::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
  transform-origin: center;
}

.quick-keyword-remove::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.quick-keyword-remove::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.quick-keyword-remove span {
  display: none;
}
</style>
