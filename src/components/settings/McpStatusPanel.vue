<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  mcpServiceRestart,
  mcpServiceStart,
  mcpServiceStatus,
  mcpServiceStop,
  type McpServiceSnapshot,
} from '../../services/mcp';
import { getErrorMessage } from '../../utils/error';

const props = defineProps<{
  locale: string;
}>();

const emit = defineEmits<{
  change: [snapshot: McpServiceSnapshot];
}>();

const snapshot = ref<McpServiceSnapshot | null>(null);
const errorMessage = ref('');
const pendingAction = ref<'refresh' | 'start' | 'stop' | 'restart' | null>(null);

const text = computed(() => {
  const en = props.locale === 'en-US';
  return {
    status: en ? 'Service status' : '\u670d\u52a1\u72b6\u6001',
    running: en ? 'Running' : '\u8fd0\u884c\u4e2d',
    stopped: en ? 'Stopped' : '\u672a\u8fd0\u884c',
    refreshing: en ? 'Refreshing...' : '\u5237\u65b0\u4e2d...',
    start: en ? 'Start' : '\u542f\u52a8',
    stop: en ? 'Stop' : '\u505c\u6b62',
    restart: en ? 'Restart' : '\u91cd\u542f',
    refresh: en ? 'Refresh' : '\u5237\u65b0',
    process: en ? 'Process' : '\u8fdb\u7a0b',
    pid: 'PID',
    startedAt: en ? 'Started at' : '\u542f\u52a8\u65f6\u95f4',
    lastError: en ? 'Last error' : '\u6700\u8fd1\u9519\u8bef',
    none: '-',
  };
});

const statusLabel = computed(() => (snapshot.value?.running ? text.value.running : text.value.stopped));
const startedAtLabel = computed(() => {
  if (!snapshot.value?.startedAtMs) return text.value.none;
  return new Date(Number(snapshot.value.startedAtMs)).toLocaleString();
});
const lastErrorLabel = computed(() => errorMessage.value || snapshot.value?.error || text.value.none);
const busy = computed(() => pendingAction.value !== null);

async function runAction(action: typeof pendingAction.value, task: () => Promise<McpServiceSnapshot>) {
  if (!action) return;
  pendingAction.value = action;
  errorMessage.value = '';
  try {
    snapshot.value = await task();
    emit('change', snapshot.value);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    pendingAction.value = null;
  }
}

onMounted(() => {
  void runAction('refresh', mcpServiceStatus);
});
</script>

<template>
  <div class="mcp-status-panel">
    <div class="mcp-status-head">
      <span class="mcp-status-pill" :class="snapshot?.running ? 'running' : 'stopped'">{{ statusLabel }}</span>
      <span class="mcp-status-actions">
        <button class="secondary-button compact" type="button" :disabled="busy || snapshot?.running" @click="runAction('start', mcpServiceStart)">
          {{ pendingAction === 'start' ? text.refreshing : text.start }}
        </button>
        <button class="secondary-button compact" type="button" :disabled="busy || !snapshot?.running" @click="runAction('stop', mcpServiceStop)">
          {{ text.stop }}
        </button>
        <button class="secondary-button compact" type="button" :disabled="busy" @click="runAction('restart', mcpServiceRestart)">
          {{ text.restart }}
        </button>
        <button class="secondary-button compact" type="button" :disabled="busy" @click="runAction('refresh', mcpServiceStatus)">
          {{ pendingAction === 'refresh' ? text.refreshing : text.refresh }}
        </button>
      </span>
    </div>

    <div class="mcp-status-grid">
      <span>{{ text.process }}</span>
      <strong>{{ snapshot?.worker ?? 'mcp-api' }}</strong>
      <span>{{ text.pid }}</span>
      <strong>{{ snapshot?.pid ?? text.none }}</strong>
      <span>{{ text.startedAt }}</span>
      <strong>{{ startedAtLabel }}</strong>
      <span>{{ text.lastError }}</span>
      <strong>{{ lastErrorLabel }}</strong>
    </div>
  </div>
</template>

<style scoped>
.mcp-status-panel {
  display: grid;
  gap: 10px;
  max-width: 860px;
  padding: 12px;
  border: 1px solid var(--smw-border);
  border-radius: 8px;
  background: var(--smw-bg-panel);
}

.mcp-status-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.mcp-status-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mcp-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  color: var(--smw-text-secondary);
  background: var(--smw-bg-input);
  font-size: 12px;
  font-weight: 680;
}

.mcp-status-pill.running {
  color: #087f5b;
  background: rgba(8, 127, 91, 0.12);
}

.mcp-status-pill.stopped {
  color: #b42318;
  background: rgba(180, 35, 24, 0.1);
}

.mcp-status-grid {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
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

.secondary-button.compact:hover {
  border-color: color-mix(in srgb, var(--smw-button-primary) 34%, var(--smw-border));
  color: var(--smw-button-primary);
  background: color-mix(in srgb, var(--smw-button-primary) 8%, var(--smw-bg-input));
}

.secondary-button.compact:focus-visible {
  border-color: var(--smw-button-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--smw-button-primary) 14%, transparent);
  outline: none;
}
</style>
