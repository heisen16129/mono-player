<script setup lang="ts">
defineProps<{
  countLabel: string;
  selected: boolean;
  title: string;
}>();

const emit = defineEmits<{
  select: [];
}>();
</script>

<template>
  <button
    class="quick-row"
    :class="{ selected }"
    type="button"
    @click="emit('select')"
  >
    <span class="quick-icon"><slot name="icon" /></span>
    <span class="quick-copy">
      <strong>{{ title }}</strong>
      <small>{{ countLabel }}</small>
    </span>
  </button>
</template>

<style scoped>
.quick-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  column-gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.quick-row:hover,
.quick-row.selected {
  background: var(--smw-bg-selected);
}

.quick-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-input);
}

.quick-copy {
  display: grid;
  gap: 2px;
  align-content: center;
  min-width: 0;
}

.quick-row strong {
  font-size: 14px;
  font-weight: 520;
  line-height: 1.2;
}

.quick-row small {
  color: var(--smw-text-secondary);
  font-size: 13px;
  line-height: 1.2;
}
</style>
