<script setup lang="ts">
defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  collapse: [];
}>();
</script>

<template>
  <button
    class="icon-button collapse-button"
    type="button"
    :aria-label="label"
    :title="label"
    @click="emit('collapse')"
  >
    <svg class="collapse-glyph" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="3" />
      <path d="M9.25 4.75v10.5" />
    </svg>
  </button>
</template>

<style scoped>
.collapse-button {
  width: 34px;
  height: 38px;
  color: var(--smw-icon-muted);
}

.collapse-glyph {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.45;
}
</style>
