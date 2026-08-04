import { invokeApi } from './api';
import { isTauriRuntime } from './music';

export interface McpServiceSnapshot {
  worker: string;
  running: boolean;
  pid: number | null;
  startedAtMs: number | null;
  error: string | null;
  restartPolicy: string | null;
  endpoint: string;
  healthEndpoint: string;
}

const fallbackSnapshot: McpServiceSnapshot = {
  worker: 'mcp-api',
  running: false,
  pid: null,
  startedAtMs: null,
  error: null,
  restartPolicy: 'noRestart',
  endpoint: 'http://127.0.0.1:17331/mcp',
  healthEndpoint: 'http://127.0.0.1:17331/health',
};

export function mcpServiceStatus(): Promise<McpServiceSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(fallbackSnapshot);
  return invokeApi<McpServiceSnapshot>('mcp_service_status');
}

export function mcpServiceStart(): Promise<McpServiceSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve({ ...fallbackSnapshot, running: true });
  return invokeApi<McpServiceSnapshot>('mcp_service_start');
}

export function mcpServiceStop(): Promise<McpServiceSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve(fallbackSnapshot);
  return invokeApi<McpServiceSnapshot>('mcp_service_stop');
}

export function mcpServiceRestart(): Promise<McpServiceSnapshot> {
  if (!isTauriRuntime()) return Promise.resolve({ ...fallbackSnapshot, running: true });
  return invokeApi<McpServiceSnapshot>('mcp_service_restart');
}
