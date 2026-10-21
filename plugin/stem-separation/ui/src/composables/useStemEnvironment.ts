import { separation } from '../api';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { StemEnvironmentStatus } from '../types/stemSeparation';
import { getErrorMessage } from '../utils/error';

export function useStemEnvironment() {
  const environment = ref<StemEnvironmentStatus>({ stage: 'checking', message: '正在检查分离环境…', pythonPath: null });
  const busy = computed(() => ['checking', 'installing', 'cancelling'].includes(environment.value.stage));
  const ready = computed(() => environment.value.stage === 'ready');
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function fail(cause: unknown) { environment.value = { stage: 'error', message: getErrorMessage(cause), pythonPath: null }; }
  async function refresh() {
    try { const next = await separation.getEnvironment(); if (!disposed) environment.value = next; }
    catch (cause) { fail(cause); }
    finally { if (!disposed) timer = setTimeout(refresh, 1000); }
  }
  async function prepare() {
    try { environment.value = await separation.prepareEnvironment(); }
    catch (cause) { fail(cause); }
  }
  async function cancel() {
    try { await separation.cancelEnvironment(); }
    catch (cause) { fail(cause); }
  }
  onMounted(async () => {
    try { const next = await separation.checkEnvironment(); if (!disposed) environment.value = next; }
    catch (cause) { fail(cause); }
    if (!disposed) void refresh();
  });
  onBeforeUnmount(() => { disposed = true; clearTimeout(timer); });
  return { environment, busy, ready, prepare, cancel };
}
