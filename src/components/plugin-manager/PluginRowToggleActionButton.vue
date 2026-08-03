<script setup lang="ts">
defineProps<{
  enabled: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button
    :class="['plugin-toggle-action', enabled ? 'is-enabled' : 'is-disabled']"
    type="button"
    :title="enabled ? '点击停用插件' : '点击启用插件'"
    @click="emit('toggle')"
  >
    <span aria-hidden="true"></span>
    {{ enabled ? '停用' : '启用' }}
  </button>
</template>

<style scoped>
.plugin-toggle-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 24px;
  padding: 0;
  border: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 560;
  cursor: pointer;
}

.plugin-toggle-action:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.plugin-toggle-action span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.plugin-toggle-action.is-enabled {
  color: var(--smw-text-body);
  background: transparent;
}

.plugin-toggle-action.is-enabled span {
  background: var(--smw-status-green);
}

.plugin-toggle-action.is-disabled {
  color: var(--smw-text-secondary);
  background: transparent;
}

.plugin-toggle-action.is-disabled span {
  background: var(--smw-text-secondary);
}
</style>
