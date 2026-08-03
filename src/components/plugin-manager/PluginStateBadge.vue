<script setup lang="ts">
defineProps<{
  enabled?: boolean;
  installed: boolean;
}>();
</script>

<template>
  <span :class="['state-badge', installed ? 'installed' : 'available']">
    {{ installed ? (enabled ? '已启用' : '已停用') : '可安装' }}
  </span>
</template>

<style scoped>
.state-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
}

.state-badge.installed {
  color: var(--smw-status-green);
}

.state-badge.available {
  color: var(--smw-text-secondary);
}
</style>
