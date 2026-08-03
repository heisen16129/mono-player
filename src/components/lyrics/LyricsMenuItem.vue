<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const emit = defineEmits<{
  select: [];
}>();
</script>

<template>
  <button class="lyrics-menu-item" type="button" :disabled="disabled" @click="emit('select')">
    <slot />
  </button>
</template>

<style scoped>
.lyrics-menu-item {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  color: var(--smw-text-body);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.lyrics-menu-item:hover,
.lyrics-menu-item:focus-visible {
  background: var(--smw-bg-hover);
  outline: none;
}

.lyrics-menu-item:disabled {
  color: var(--smw-text-muted);
  cursor: default;
  opacity: 0.58;
}

.lyrics-menu-item:disabled:hover {
  background: transparent;
}
</style>
