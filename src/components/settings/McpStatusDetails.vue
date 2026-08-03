<script setup lang="ts">
defineProps<{
  errorLabel: string;
  pidLabel: number | string;
  restartPolicyLabel: string;
  startedAtLabel: string;
  workerLabel: string;
}>();
</script>

<template>
  <div class="mcp-status-grid">
    <span>进程</span>
    <strong>{{ workerLabel }}</strong>
    <span>PID</span>
    <strong>{{ pidLabel }}</strong>
    <span>启动时间</span>
    <strong>{{ startedAtLabel }}</strong>
    <span>重启策略</span>
    <strong>{{ restartPolicyLabel }}</strong>
    <span>最近错误</span>
    <strong>{{ errorLabel }}</strong>
  </div>
</template>

<style scoped>
.mcp-status-grid {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 7px 12px;
  color: var(--smw-text-secondary);
  font-size: 12px;
}

.mcp-status-grid strong {
  min-width: 0;
  overflow: hidden;
  color: var(--smw-text-body);
  font-weight: 520;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
