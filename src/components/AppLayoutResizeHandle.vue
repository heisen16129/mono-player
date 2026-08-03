<script setup lang="ts">
defineProps<{
  resizing: boolean;
}>();

defineEmits<{
  startResize: [event: PointerEvent];
}>();
</script>

<template>
  <div
    class="library-resize-handle"
    :class="{
      'is-resizing': resizing,
    }"
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize library sidebar"
    @pointerdown="$emit('startResize', $event)"
  ></div>
</template>

<style scoped>
.library-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--library-width) - 4px);
  z-index: 12;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
}

.library-resize-handle::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 1px;
  background: transparent;
  content: '';
  transition: background 140ms ease, box-shadow 140ms ease;
}

.library-resize-handle:hover::after,
.library-resize-handle.is-resizing::after {
  background: var(--smw-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--smw-accent) 18%, transparent);
}

@media (max-width: 820px) {
  .library-resize-handle {
    display: none;
  }
}
</style>
