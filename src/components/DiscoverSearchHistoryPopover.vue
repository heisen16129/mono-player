<script setup lang="ts">
import { Clock3, Trash2 } from '@lucide/vue';

defineProps<{
  history: string[];
  visible: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  close: [];
  remove: [keyword: string];
  search: [keyword: string];
}>();
</script>

<template>
  <div v-if="visible" class="search-history-popover" @pointerdown.stop>
    <header class="search-history-head">
      <div class="search-history-title">
        <Clock3 :size="16" />
        <span>搜索历史</span>
      </div>
      <button type="button" class="text-button" @click="emit('clear')">
        <Trash2 :size="15" />
        <span>清空</span>
      </button>
    </header>

    <div v-if="history.length > 0" class="search-history-list">
      <div v-for="keyword in history" :key="keyword" class="history-chip">
        <button type="button" class="history-chip-search" @click="emit('search', keyword)">
          <span class="history-chip-text">{{ keyword }}</span>
        </button>
        <button type="button" class="history-chip-remove" :aria-label="`删除 ${keyword}`" @click="emit('remove', keyword)">
          <span aria-hidden="true"></span>
        </button>
      </div>
    </div>
    <p v-else class="search-history-empty">暂无历史记录</p>
  </div>
</template>

<style scoped>
.search-history-popover {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 20;
  display: grid;
  gap: 14px;
  width: min(760px, 100%);
  padding: 18px 20px 20px;
  border: 1px solid var(--smw-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--smw-bg-panel) 96%, transparent);
  box-shadow: 0 18px 52px color-mix(in srgb, #000 12%, transparent);
}

.search-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.search-history-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--smw-text-primary);
  font-size: 14px;
  font-weight: 620;
}

.text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  padding: 0;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.text-button:hover {
  color: var(--smw-text-primary);
}

.search-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.history-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--smw-text-primary);
  background: var(--smw-bg-selected);
}

.history-chip-search {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0;
  border: 0;
  color: var(--smw-text-primary);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.history-chip:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 20%, var(--smw-border));
  background: var(--smw-bg-hover);
}

.history-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-chip-remove {
  position: absolute;
  right: -4px;
  top: -4px;
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
  line-height: 0;
  transition: opacity 120ms ease;
}

.history-chip:hover .history-chip-remove,
.history-chip:focus-within .history-chip-remove {
  opacity: 1;
  pointer-events: auto;
}

.history-chip-remove:hover {
  color: var(--smw-text-primary);
  background: color-mix(in srgb, var(--smw-bg-hover) 70%, transparent);
}

.history-chip-remove::before,
.history-chip-remove::after {
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

.history-chip-remove::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.history-chip-remove::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.history-chip-remove span {
  display: none;
}

.search-history-empty {
  margin: 0;
  color: var(--smw-text-secondary);
  font-size: 13px;
}
</style>
