<script setup lang="ts">
defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  expand: [];
}>();
</script>

<template>
  <button
    class="brand-mark brand-mark-button"
    :class="{ 'is-collapsed': collapsed }"
    type="button"
    aria-label="Mono Player"
    title="Mono Player"
    @click="collapsed && emit('expand')"
  >
    <span class="brand-letter">M</span>
    <svg class="brand-expand-glyph" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
      <path d="M10.75 4.75v10.5" />
    </svg>
  </button>
</template>

<style scoped>
.brand-mark {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--smw-border-strong);
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}

.brand-letter,
.brand-expand-glyph {
  grid-area: 1 / 1;
  transition:
    opacity 120ms ease,
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.brand-expand-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  opacity: 0;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
  transform: scale(0.86);
}

.brand-mark-button {
  padding: 0;
  border: 0;
  appearance: none;
  cursor: default;
}

.brand-mark-button.is-collapsed {
  cursor: pointer;
}

.brand-mark-button.is-collapsed:hover .brand-letter,
.brand-mark-button.is-collapsed:focus-visible .brand-letter {
  opacity: 0;
  transform: scale(0.86);
}

.brand-mark-button.is-collapsed:hover .brand-expand-glyph,
.brand-mark-button.is-collapsed:focus-visible .brand-expand-glyph {
  opacity: 1;
  transform: scale(1);
}
</style>
