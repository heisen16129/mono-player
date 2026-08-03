<script setup lang="ts">
defineProps<{
  active: boolean;
  index: number;
  installed: boolean;
}>();

const emit = defineEmits<{
  startDrag: [event: PointerEvent];
}>();
</script>

<template>
  <button
    class="drag-handle"
    type="button"
    :class="{ active, 'is-draggable': installed }"
    :title="installed ? '拖动排序' : ''"
    @pointerdown="emit('startDrag', $event)"
  >
    {{ index + 1 }}
  </button>
</template>

<style scoped>
.drag-handle {
  display: inline-grid;
  width: 28px;
  height: 26px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-secondary);
  background: transparent;
  font: inherit;
  user-select: none;
  touch-action: none;
}

.drag-handle.is-draggable {
  cursor: grab;
}

.drag-handle.is-draggable:hover,
.drag-handle.is-draggable.active {
  color: var(--smw-text-primary);
  background: var(--smw-bg-hover);
}

.drag-handle.is-draggable:active {
  cursor: grabbing;
}
</style>
