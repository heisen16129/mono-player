import { invoke, isTauri } from '@tauri-apps/api/core';

export function traceStartup(stage: string) {
  const elapsedMs = performance.now();
  console.info(`[startup] ${stage} frontend_ms=${Math.round(elapsedMs)}`);
  if (isTauri()) {
    void invoke('startup_trace', { stage, elapsedMs }).catch(() => {});
  }
}
