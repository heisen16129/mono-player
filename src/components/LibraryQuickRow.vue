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
      <small v-if="countLabel">{{ countLabel }}</small>
    </span>
  </button>
</template>

<style scoped>
.quick-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  column-gap: 4px;
  align-items: center;
  height: 48px;
  padding: 0;
  box-sizing: border-box;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--smw-text-body);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 160ms ease, color 180ms ease;
}

.quick-row:hover,
.quick-row.selected {
  background: var(--smw-bg-selected);
}

.quick-icon {
  display: grid;
  width: 58px;
  height: 48px;
  place-items: center;
  border-radius: 8px;
}

.quick-icon :deep(svg) {
  width: 22px;
  height: 22px;
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
