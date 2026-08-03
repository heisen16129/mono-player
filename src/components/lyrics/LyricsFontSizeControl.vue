<script setup lang="ts">
defineProps<{
  fontSize: number;
}>();

const emit = defineEmits<{
  decrease: [];
  increase: [];
}>();
</script>

<template>
  <span class="lyrics-font-menu-title">设置字号</span>
  <div class="lyrics-font-menu-row">
    <button type="button" aria-label="减小字号" @click="emit('decrease')">
      A<small>-</small>
    </button>
    <strong>{{ fontSize }}</strong>
    <button type="button" aria-label="增大字号" @click="emit('increase')">
      A<small>+</small>
    </button>
  </div>
</template>

<style scoped>
.lyrics-font-menu-title {
  padding: 0 12px 8px;
  color: var(--smw-text-secondary);
  font-size: 13px;
}

.lyrics-font-menu-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  gap: 10px;
  align-items: center;
  padding: 0 12px 10px;
}

.lyrics-font-menu-row button {
  display: inline-grid;
  height: 28px;
  place-items: center;
  border: 0;
  color: var(--smw-text-primary);
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.lyrics-font-menu-row button:hover {
  border-radius: 6px;
  background: var(--smw-bg-hover);
}

.lyrics-font-menu-row button small {
  margin-left: 1px;
  font-size: 10px;
}

.lyrics-font-menu-row strong {
  display: grid;
  height: 28px;
  place-items: center;
  border-radius: 5px;
  color: var(--smw-text-body);
  background: var(--smw-bg-selected);
  font-size: 13px;
  font-weight: 500;
}
</style>
