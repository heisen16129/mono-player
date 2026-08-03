<script setup lang="ts">
defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <button class="tray-menu-action" type="button" @click="emit('action')">
    <slot name="icon" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.tray-menu-action {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  color: var(--smw-text-body);
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.tray-menu-action:hover {
  background: var(--smw-bg-hover);
}
</style>
