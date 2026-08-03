<script setup lang="ts">
defineProps<{
  artist: string;
  title: string;
}>();

const emit = defineEmits<{
  show: [];
}>();
</script>

<template>
  <button class="tray-menu-now" type="button" @click="emit('show')">
    <strong>{{ title }}</strong>
    <span>{{ artist }}</span>
  </button>
</template>

<style scoped>
.tray-menu-now {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 7px;
  color: inherit;
  background: var(--smw-bg-selected);
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.tray-menu-now strong,
.tray-menu-now span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-menu-now strong {
  color: var(--smw-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.tray-menu-now span {
  color: var(--smw-text-secondary);
  font-size: 12px;
}
</style>
