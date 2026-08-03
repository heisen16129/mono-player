<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { systemWorkerHealth, type WorkerDiagnostic } from '../../services/music';
import { getErrorMessage } from '../../utils/error';
import McpStatusDetails from './McpStatusDetails.vue';
import McpStatusHeader from './McpStatusHeader.vue';

const mcpStatus = ref<WorkerDiagnostic | null>(null);
const mcpStatusError = ref('');
const isRefreshingMcpStatus = ref(false);
const mcpStatusLabel = computed(() => {
  if (mcpStatus.value?.running) return '运行中';
  if (mcpStatus.value || mcpStatusError.value) return '未运行';
  return '未知';
});
const mcpStatusTone = computed(() => (mcpStatus.value?.running ? 'running' : 'stopped'));
const mcpRestartPolicyLabel = computed(() => {
  switch (mcpStatus.value?.restartPolicy) {
    case 'restartOnceAndRetry':
      return '失败后重启并重试一次';
    case 'restartBeforeSendOnly':
      return '发送前可重启，不重放任务';
    case 'perTask':
      return '按任务启动';
    case 'noRestart':
      return '不自动重启';
    default:
      return '-';
  }
});
const mcpStartedAtLabel = computed(() => {
  const startedAtMs = mcpStatus.value?.startedAtMs;
  if (!startedAtMs) return '-';
  return new Date(Number(startedAtMs)).toLocaleString();
});
const mcpErrorLabel = computed(() => (mcpStatus.value?.error ?? mcpStatusError.value) || '-');

async function refreshMcpStatus() {
  isRefreshingMcpStatus.value = true;
  mcpStatusError.value = '';
  try {
    const snapshot = await systemWorkerHealth();
    mcpStatus.value = snapshot.workers.find((worker) => worker.worker === 'mcp-api') ?? null;
  } catch (error) {
    mcpStatus.value = null;
    mcpStatusError.value = getErrorMessage(error);
  } finally {
    isRefreshingMcpStatus.value = false;
  }
}

onMounted(() => {
  void refreshMcpStatus();
});
</script>

<template>
  <div class="mcp-status-panel">
    <McpStatusHeader
      :is-refreshing="isRefreshingMcpStatus"
      :status-label="mcpStatusLabel"
      :status-tone="mcpStatusTone"
      @refresh="refreshMcpStatus"
    />
    <McpStatusDetails
      :error-label="mcpErrorLabel"
      :pid-label="mcpStatus?.pid ?? '-'"
      :restart-policy-label="mcpRestartPolicyLabel"
      :started-at-label="mcpStartedAtLabel"
      :worker-label="mcpStatus?.worker ?? 'mcp-api'"
    />
  </div>
</template>

<style scoped>
.mcp-status-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

</style>
